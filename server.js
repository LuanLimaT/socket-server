const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"], // PWA e Landing Page
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Armazenar atendimentos ativos
const atendimentos = new Map()
// Armazenar agentes online
const onlineAgents = new Map()

// Função para criar atendimentos de teste
function createMockAtendimentos() {
  const mockAtendimentos = [
    {
      id: "atd_1",
      clientName: "João Silva",
      clientEmail: "joao@email.com",
      status: "waiting",
      unreadCount: 2,
      startedAt: new Date(Date.now() - 300000), // 5 minutos atrás
      messages: [
        {
          id: "msg_1",
          atendimentoId: "atd_1",
          sender: "client",
          content: "Olá, preciso de ajuda com meu pedido",
          timestamp: new Date(Date.now() - 120000),
          clientName: "João Silva",
        },
        {
          id: "msg_2",
          atendimentoId: "atd_1",
          sender: "client",
          content: "Meu pedido não chegou ainda",
          timestamp: new Date(Date.now() - 60000),
          clientName: "João Silva",
        },
      ],
      source: "test",
    },
    {
      id: "atd_2",
      clientName: "Maria Santos",
      clientEmail: "maria@email.com",
      status: "active",
      unreadCount: 0,
      startedAt: new Date(Date.now() - 600000), // 10 minutos atrás
      messages: [
        {
          id: "msg_3",
          atendimentoId: "atd_2",
          sender: "client",
          content: "Meu produto chegou com defeito",
          timestamp: new Date(Date.now() - 180000),
          clientName: "Maria Santos",
        },
        {
          id: "msg_4",
          atendimentoId: "atd_2",
          sender: "agent",
          content: "Vou verificar isso para você",
          timestamp: new Date(Date.now() - 60000),
        },
      ],
      source: "test",
    },
    {
      id: "atd_3",
      clientName: "Pedro Costa",
      clientEmail: "pedro@email.com",
      status: "waiting",
      unreadCount: 1,
      startedAt: new Date(Date.now() - 180000), // 3 minutos atrás
      messages: [
        {
          id: "msg_5",
          atendimentoId: "atd_3",
          sender: "client",
          content: "Quando meu produto será entregue?",
          timestamp: new Date(Date.now() - 90000),
          clientName: "Pedro Costa",
        },
      ],
      source: "test",
    },
  ]

  // Adicionar atendimentos ao Map
  mockAtendimentos.forEach((atendimento) => {
    atendimento.lastMessage = atendimento.messages[atendimento.messages.length - 1]
    atendimentos.set(atendimento.id, atendimento)
  })

  console.log("✅ Atendimentos de teste criados:", mockAtendimentos.length)
}

// Criar atendimentos de teste na inicialização
createMockAtendimentos()

// Middleware para autenticação de agentes (opcional)
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const username = socket.handshake.auth.username

  // Se for um agente, validar token
  if (token && username) {
    socket.isAgent = true
    socket.agentId = token
    socket.username = username
  } else {
    socket.isAgent = false
  }

  next()
})

io.on("connection", (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id} - Agente: ${socket.isAgent}`)

  // ===== EVENTOS DO CLIENTE (LANDING PAGE) =====

  // Cliente cria um novo atendimento
  socket.on("atendimento:create", (data) => {
    const { clientName, email, source } = data

    // Criar ID único para o atendimento
    const atendimentoId = `atd_${Date.now()}`

    // Criar objeto de atendimento
    const atendimento = {
      id: atendimentoId,
      clientName,
      clientEmail: email,
      status: "waiting",
      unreadCount: 0,
      startedAt: new Date(),
      messages: [],
      clientSocketId: socket.id,
      source,
    }

    // Armazenar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Associar socket do cliente ao atendimento
    socket.join(`atendimento:${atendimentoId}`)
    socket.atendimentoId = atendimentoId

    // Notificar cliente que o atendimento foi criado
    socket.emit("atendimento:created", { id: atendimentoId })

    // Notificar todos os agentes sobre o novo atendimento
    socket.broadcast.emit("atendimento:new", atendimento)

    console.log(`📝 Novo atendimento criado: ${atendimentoId} por ${clientName}`)
  })

  // Cliente envia mensagem
  socket.on("message:send", (data) => {
    const { atendimentoId, content, sender, clientName } = data

    // Verificar se o atendimento existe
    const atendimento = atendimentos.get(atendimentoId)
    if (!atendimento) {
      socket.emit("error", { message: "Atendimento não encontrado" })
      return
    }

    // Criar mensagem
    const message = {
      id: `msg_${Date.now()}`,
      atendimentoId,
      sender,
      content,
      timestamp: new Date(),
      clientName: clientName || atendimento.clientName,
    }

    // Adicionar mensagem ao atendimento
    atendimento.messages.push(message)
    atendimento.lastMessage = message

    if (sender === "client") {
      atendimento.status = "waiting"
      atendimento.unreadCount += 1
    }

    // Atualizar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Enviar mensagem para todos na sala do atendimento
    io.to(`atendimento:${atendimentoId}`).emit("message:new", message)

    // Notificar agentes sobre atualização do atendimento
    io.emit("atendimento:updated", atendimento)

    console.log(`💬 Nova mensagem em ${atendimentoId}: ${content}`)
  })

  // ===== EVENTOS DO AGENTE (PWA) =====

  // Agente entra no sistema
  socket.on("agent:join", ({ agentId }) => {
    if (!socket.isAgent) return

    // Registrar agente online
    onlineAgents.set(agentId, {
      socketId: socket.id,
      username: socket.username,
      joinedAt: new Date(),
    })

    // Enviar lista de atendimentos para o agente
    const atendimentosList = Array.from(atendimentos.values())
    socket.emit("atendimentos:list", atendimentosList)

    console.log(`👤 Agente ${socket.username} (${agentId}) entrou no sistema`)
    console.log(`📋 Enviando ${atendimentosList.length} atendimentos para o agente`)
  })

  // Agente entra em um atendimento específico
  socket.on("atendimento:join", ({ atendimentoId }) => {
    if (!socket.isAgent) return

    // Verificar se o atendimento existe
    const atendimento = atendimentos.get(atendimentoId)
    if (!atendimento) {
      socket.emit("error", { message: "Atendimento não encontrado" })
      return
    }

    // Adicionar agente à sala do atendimento
    socket.join(`atendimento:${atendimentoId}`)

    // Atualizar status do atendimento
    atendimento.status = "active"
    atendimento.agentId = socket.agentId
    atendimento.agentName = socket.username
    atendimento.unreadCount = 0

    // Atualizar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Enviar histórico de mensagens para o agente
    socket.emit("atendimento:messages", {
      atendimentoId,
      messages: atendimento.messages,
    })

    // Notificar cliente que um agente aceitou o atendimento
    socket.to(`atendimento:${atendimentoId}`).emit("atendimento:accepted", {
      atendimentoId,
      agentId: socket.agentId,
      agentName: socket.username,
    })

    // Notificar todos sobre atualização do atendimento
    io.emit("atendimento:updated", atendimento)

    console.log(`🎯 Agente ${socket.username} entrou no atendimento ${atendimentoId}`)
  })

  // ===== EVENTOS DE TESTE =====

  // Simular nova mensagem de cliente (para teste)
  socket.on("test:simulate-client-message", ({ atendimentoId }) => {
    const atendimento = atendimentos.get(atendimentoId)
    if (!atendimento) return

    const testMessages = [
      "Ainda está aí?",
      "Preciso de uma resposta urgente",
      "Quando vocês vão resolver meu problema?",
      "Obrigado pela atenção",
      "Posso falar com um supervisor?",
    ]

    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]

    const message = {
      id: `msg_${Date.now()}`,
      atendimentoId,
      sender: "client",
      content: randomMessage,
      timestamp: new Date(),
      clientName: atendimento.clientName,
    }

    // Adicionar mensagem ao atendimento
    atendimento.messages.push(message)
    atendimento.lastMessage = message
    atendimento.status = "waiting"
    atendimento.unreadCount += 1

    // Atualizar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Enviar mensagem para todos na sala do atendimento
    io.to(`atendimento:${atendimentoId}`).emit("message:new", message)

    // Notificar agentes sobre atualização do atendimento
    io.emit("atendimento:updated", atendimento)

    console.log(`🧪 Mensagem de teste simulada: ${randomMessage}`)
  })

  // Desconexão
  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`)

    // Se for um agente, remover da lista de agentes online
    if (socket.isAgent && socket.agentId) {
      onlineAgents.delete(socket.agentId)
      console.log(`👤 Agente ${socket.username} saiu do sistema`)
    }

    // Se for um cliente com atendimento ativo, marcar atendimento como inativo
    if (!socket.isAgent && socket.atendimentoId) {
      const atendimento = atendimentos.get(socket.atendimentoId)
      if (atendimento) {
        atendimento.clientConnected = false
        atendimentos.set(socket.atendimentoId, atendimento)

        // Notificar agentes sobre cliente desconectado
        io.emit("atendimento:updated", atendimento)
      }
    }
  })
})

// Rota simples para verificar se o servidor está rodando
app.get("/", (req, res) => {
  res.json({
    message: "Servidor Socket.IO está rodando!",
    atendimentos: atendimentos.size,
    agentesOnline: onlineAgents.size,
  })
})

// Rota para listar atendimentos (para debug)
app.get("/atendimentos", (req, res) => {
  const atendimentosList = Array.from(atendimentos.values())
  res.json(atendimentosList)
})

// Função para simular novas mensagens periodicamente (para teste)
function simulateClientMessages() {
  setInterval(() => {
    const atendimentosArray = Array.from(atendimentos.values())
    const waitingAtendimentos = atendimentosArray.filter((a) => a.status === "waiting")

    if (waitingAtendimentos.length > 0 && Math.random() > 0.7) {
      const randomAtendimento = waitingAtendimentos[Math.floor(Math.random() * waitingAtendimentos.length)]

      const testMessages = [
        "Alguém pode me ajudar?",
        "Ainda estou esperando uma resposta...",
        "Por favor, preciso de ajuda urgente",
        "Olá? Tem alguém aí?",
      ]

      const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)]

      const message = {
        id: `msg_${Date.now()}`,
        atendimentoId: randomAtendimento.id,
        sender: "client",
        content: randomMessage,
        timestamp: new Date(),
        clientName: randomAtendimento.clientName,
      }

      // Adicionar mensagem ao atendimento
      randomAtendimento.messages.push(message)
      randomAtendimento.lastMessage = message
      randomAtendimento.unreadCount += 1

      // Atualizar atendimento
      atendimentos.set(randomAtendimento.id, randomAtendimento)

      // Enviar mensagem para todos na sala do atendimento
      io.to(`atendimento:${randomAtendimento.id}`).emit("message:new", message)

      // Notificar agentes sobre atualização do atendimento
      io.emit("atendimento:updated", randomAtendimento)

      console.log(`🤖 Mensagem automática simulada de ${randomAtendimento.clientName}: ${randomMessage}`)
    }
  }, 15000) // A cada 15 segundos
}

// Iniciar simulação de mensagens (descomente para ativar)
// simulateClientMessages();

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}`)
  console.log(`📋 Atendimentos: http://localhost:${PORT}/atendimentos`)
})
