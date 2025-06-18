class AtendimentoPresenter {
  constructor(io, service) {
    this.io = io;
    this.service = service;
  }

  conectarSocket(socket) {
    // Evita duplicação de listeners
    socket.removeAllListeners("atendimento:create");
    socket.removeAllListeners("message:send");
    socket.removeAllListeners("agent:join");
    socket.removeAllListeners("atendimento:join");
    socket.removeAllListeners("agent:typing");
    socket.removeAllListeners("disconnect");

    socket.on("atendimento:create", (data) => this.criarAtendimento(socket, data));
    socket.on("message:send", (data) => this.enviarMensagem(socket, data));
    socket.on("agent:join", (data) => this.agentJoin(socket, data));
    socket.on("atendimento:join", (data) => this.agentJoinAtendimento(socket, data));
    socket.on("agent:typing", (data) => this.agentTyping(socket, data));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  criarAtendimento(socket, data) {
    const atendimento = this.service.criarAtendimento({ ...data, socketId: socket.id });
    socket.join(`atendimento:${atendimento.id}`);
    socket.atendimentoId = atendimento.id;
    socket.emit("atendimento:created", { id: atendimento.id });
    this.io.emit("atendimento:new", atendimento);

    if (atendimento.autoCreated) {
      const welcomeMsg = {
        id: `msg_${Date.now()}`,
        atendimentoId: atendimento.id,
        sender: "system",
        content: `${atendimento.clientName} entrou no chat`,
        timestamp: new Date(),
        clientName: atendimento.clientName,
      };
      this.service.adicionarMensagem(atendimento.id, welcomeMsg);
      this.io.emit("message:new", welcomeMsg);
      this.io.emit("atendimento:updated", atendimento);
    }
  }

  enviarMensagem(socket, data) {

    const { atendimentoId, content, sender, clientName } = data;
    const atendimento = this.service.getAtendimento(atendimentoId);

    if (!atendimento) {
      socket.emit("error", { message: "Atendimento não encontrado" });
      return;
    }

    const message = {
      id: `msg_${Date.now()}`,
      atendimentoId,
      sender,
      content,
      timestamp: new Date(),
      clientName: clientName || atendimento.clientName,
    };

    const updated = this.service.adicionarMensagem(atendimentoId, message);
    this.io.to(`atendimento:${atendimentoId}`).emit("message:new", message);
    this.io.emit("atendimento:updated", updated);
  }

  agentJoin(socket, data) {
    if (!socket.isAgent) return;

    const { agentId } = data;
    this.service.addAgente(agentId, {
      socketId: socket.id,
      username: socket.username,
      joinedAt: new Date(),
    });
    const list = this.service.listarAtendimentos();
    socket.emit("atendimentos:list", list);
  }

  agentJoinAtendimento(socket, data) {
    if (!socket.isAgent) return;

    const { atendimentoId } = data;
    const atendimento = this.service.getAtendimento(atendimentoId);

    if (!atendimento) {
      socket.emit("error", { message: "Atendimento não encontrado" });
      return;
    }

    socket.join(`atendimento:${atendimentoId}`);
    const updated = this.service.atualizarStatusAtendimento(atendimentoId, {
      status: "active",
      agentId: socket.agentId,
      agentName: socket.username,
      unreadCount: 0,
    });

    socket.emit("atendimento:messages", {
      atendimentoId,
      messages: updated.messages,
    });

    socket.to(`atendimento:${atendimentoId}`).emit("atendimento:accepted", {
      atendimentoId,
      agentId: socket.agentId,
      agentName: socket.username,
    });

    this.io.emit("atendimento:updated", updated);
  }

  agentTyping(socket, data) {
    if (!socket.isAgent) return;

    const { atendimentoId } = data;
    socket.to(`atendimento:${atendimentoId}`).emit("agent:typing", {
      atendimentoId,
      agentName: socket.username,
    });
  }

  handleDisconnect(socket) {
    if (socket.isAgent && socket.agentId) {
      this.service.removeAgente(socket.agentId);
    }

    if (!socket.isAgent && socket.atendimentoId) {
      const atendimento = this.service.getAtendimento(socket.atendimentoId);
      if (atendimento) {
        this.service.atualizarStatusAtendimento(socket.atendimentoId, {
          clientConnected: false,
        });
        this.io.emit("atendimento:updated", atendimento);
      }
    }
  }
}

module.exports = AtendimentoPresenter;
