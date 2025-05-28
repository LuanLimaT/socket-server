const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3002"], // PWA e Landing Page
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Armazenar atendimentos ativos
const atendimentos = new Map()
// Armazenar agentes online
const onlineAgents = new Map()

// Middleware para identificar tipo de cliente
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const username = socket.handshake.auth.username

  // Se for um agente (PWA), validar token
  if (token && username) {
    socket.isAgent = true
    socket.agentId = token
    socket.username = username
    console.log(`🔐 Agente autenticado: ${username}`)
  } else {
    socket.isAgent = false
    console.log(`👤 Cliente conectado: ${socket.id}`)
  }

  next()
})

io.on("connection", (socket) => {
  console.log(`🔌 Nova conexão: ${socket.id} - Tipo: ${socket.isAgent ? "Agente" : "Cliente"}`)

  // ===== EVENTOS DO CLIENTE (LANDING PAGE) =====

  // Cliente cria um novo atendimento
  socket.on("atendimento:create", (data) => {
    const { clientName, email, source, autoCreated } = data

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
      autoCreated: autoCreated || false,
    }

    // Armazenar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Associar socket do cliente ao atendimento
    socket.join(`atendimento:${atendimentoId}`)
    socket.atendimentoId = atendimentoId

    // Notificar cliente que o atendimento foi criado
    socket.emit("atendimento:created", { id: atendimentoId })

    // Notificar TODOS os agentes sobre o novo atendimento
    io.emit("atendimento:new", atendimento)

    console.log(`📝 Novo atendimento criado: ${atendimentoId} por ${clientName} (Auto: ${autoCreated})`)

    // Se foi criado automaticamente, adicionar mensagem inicial
    if (autoCreated) {
      const welcomeMessage = {
        id: `msg_${Date.now()}`,
        atendimentoId,
        sender: "system",
        content: `${clientName} entrou no chat`,
        timestamp: new Date(),
        clientName,
      }

      atendimento.messages.push(welcomeMessage)
      atendimento.lastMessage = welcomeMessage
      atendimentos.set(atendimentoId, atendimento)

      // Notificar agentes sobre a mensagem inicial
      io.emit("message:new", welcomeMessage)
      io.emit("atendimento:updated", atendimento)
    }
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
    } else if (sender === "agent") {
      atendimento.status = "active"
      // Reset unread count quando agente responde
      atendimento.unreadCount = 0
    }

    // Atualizar atendimento
    atendimentos.set(atendimentoId, atendimento)

    // Enviar mensagem para todos na sala do atendimento
    io.to(`atendimento:${atendimentoId}`).emit("message:new", message)

    // Notificar TODOS sobre atualização do atendimento
    io.emit("atendimento:updated", atendimento)

    console.log(`💬 Nova mensagem em ${atendimentoId}: [${sender}] ${content}`)
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

    // Notificar TODOS sobre atualização do atendimento
    io.emit("atendimento:updated", atendimento)

    console.log(`🎯 Agente ${socket.username} entrou no atendimento ${atendimentoId}`)
  })

  // Agente está digitando
  socket.on("agent:typing", ({ atendimentoId }) => {
    if (!socket.isAgent) return

    socket.to(`atendimento:${atendimentoId}`).emit("agent:typing", {
      atendimentoId,
      agentName: socket.username,
    })
  })

  // Desconexão
  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`)

    // Se for um agente, remover da lista de agentes online
    if (socket.isAgent && socket.agentId) {
      onlineAgents.delete(socket.agentId)
      console.log(`👤 Agente ${socket.username} saiu do sistema`)
    }

    // Se for um cliente com atendimento ativo, marcar como desconectado
    if (!socket.isAgent && socket.atendimentoId) {
      const atendimento = atendimentos.get(socket.atendimentoId)
      if (atendimento) {
        atendimento.clientConnected = false
        atendimentos.set(socket.atendimentoId, atendimento)

        // Notificar agentes sobre cliente desconectado
        io.emit("atendimento:updated", atendimento)

        console.log(`📱 Cliente do atendimento ${socket.atendimentoId} desconectou`)
      }
    }
  })
})

// Rota para verificar status do servidor
app.get("/", (req, res) => {
  res.json({
    message: "Servidor Socket.IO está rodando!",
    atendimentos: atendimentos.size,
    agentesOnline: onlineAgents.size,
    timestamp: new Date().toISOString(),
  })
})

// Rota para listar atendimentos (debug)
app.get("/atendimentos", (req, res) => {
  const atendimentosList = Array.from(atendimentos.values())
  res.json(atendimentosList)
})

// Rota para estatísticas
app.get("/stats", (req, res) => {
  const atendimentosList = Array.from(atendimentos.values())
  const stats = {
    total: atendimentosList.length,
    waiting: atendimentosList.filter((a) => a.status === "waiting").length,
    active: atendimentosList.filter((a) => a.status === "active").length,
    closed: atendimentosList.filter((a) => a.status === "closed").length,
    agentsOnline: onlineAgents.size,
  }
  res.json(stats)
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO rodando na porta ${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}`)
  console.log(`📋 Atendimentos: http://localhost:${PORT}/atendimentos`)
  console.log(`📈 Estatísticas: http://localhost:${PORT}/stats`)
})
