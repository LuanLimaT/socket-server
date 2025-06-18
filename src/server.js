const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const AtendimentoModel = require("./model/AtendimentoModel")
const AtendimentoService = require("./service/AtendimentoService")
const AtendimentoPresenter = require("./presenter/AtendimentoPresenter")
const AtendimentoController = require("./controller/AtendimentoController")
const atendimentoRoutes = require("./routes/atendimentoRoutes")
const setupSwagger = require("./swagger")

const app = express()
app.use(cors())
setupSwagger(app)

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const model = new AtendimentoModel()
const service = new AtendimentoService(model)
const presenter = new AtendimentoPresenter(io, service)
const controller = new AtendimentoController(service)

io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const username = socket.handshake.auth.username

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
  presenter.conectarSocket(socket)
})

app.use("/atendimentos", atendimentoRoutes(controller))

app.get("/stats", (req, res) => {
  const stats = service.getEstatisticas()
  res.json(stats)
})

app.get("/", (req, res) => {
  res.json({ message: "Servidor rodando" })
})

const PORT = process.env.PORT || 3002
server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO rodando na porta ${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}`)
  console.log(`📋 Atendimentos: http://localhost:${PORT}/atendimentos`)
  console.log(`📈 Estatísticas: http://localhost:${PORT}/stats`)
})
