// src/model/AtendimentoModel.js

class AtendimentoModel {
  constructor() {
    this.atendimentos = new Map(); // ID => dados do atendimento
    this.agentesOnline = new Map(); // ID => info do agente
    this.ultimoId = 1;
  }

  addAtendimento(atendimento) {
    const id = this.ultimoId++;
    this.atendimentos.set(id, { id, ...atendimento });
    return id;
  }

  getAtendimento(id) {
    return this.atendimentos.get(id);
  }

  updateAtendimento(id, data) {
    if (this.atendimentos.has(id)) {
      const atual = this.atendimentos.get(id);
      const atualizado = { ...atual, ...data };
      this.atendimentos.set(id, atualizado);
      return atualizado;
    }
    return null;
  }

  updateStatusAtendimento(id, statusData) {
    if (!this.atendimentos.has(id)) return null;
    const atendimento = this.atendimentos.get(id);
    const atualizado = { ...atendimento, ...statusData };
    this.atendimentos.set(id, atualizado);
    return atualizado;
  }

  listarAtendimentos() {
    return Array.from(this.atendimentos.values());
  }

  addAgente(agentId, info) {
    this.agentesOnline.set(agentId, info);
  }

  removeAgente(agentId) {
    this.agentesOnline.delete(agentId);
  }

  listAgentes() {
    return Array.from(this.agentesOnline.values());
  }

  adicionarMensagem(atendimentoId, message) {
    const atendimento = this.atendimentos.get(atendimentoId);
    if (!atendimento) return null;

    atendimento.messages = atendimento.messages || [];
    atendimento.messages.push(message);
    atendimento.lastMessage = message;

    if (message.sender === "client") {
      atendimento.status = "waiting";
      atendimento.unreadCount = (atendimento.unreadCount || 0) + 1;
    } else {
      atendimento.status = "active";
      atendimento.unreadCount = 0;
    }

    this.atendimentos.set(atendimentoId, atendimento);
    return atendimento;
}


}

module.exports = AtendimentoModel;
