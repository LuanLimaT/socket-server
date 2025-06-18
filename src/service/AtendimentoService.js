class AtendimentoService {
  constructor(model) {
    this.model = model;
  }

  criarAtendimento(atendimento) {
    const id = this.model.addAtendimento(atendimento);
    return this.model.getAtendimento(id);
  }

  getAtendimento(id) {
    return this.model.getAtendimento(id);
  }

  atualizarAtendimento(id, data) {
    return this.model.updateAtendimento(id, data);
  }

  atualizarStatusAtendimento(id, statusData) {
    return this.model.updateStatusAtendimento(id, statusData);
  }

  listarAtendimentos() {
    return this.model.listarAtendimentos()
  }

  addAgente(agentId, info) {
    this.model.addAgente(agentId, info);
  }

  removeAgente(agentId) {
    this.model.removeAgente(agentId);
  }

  listarAgentes() {
    return this.model.listAgentes();
  }

  getEstatisticas() {
    return {
      totalAtendimentos: this.model.atendimentos.size,
      totalAgentes: this.model.agentesOnline.size,
    };
  }

  adicionarMensagem(atendimentoId, message) {
    return this.model.adicionarMensagem(atendimentoId, message);
  }


}

module.exports = AtendimentoService;
