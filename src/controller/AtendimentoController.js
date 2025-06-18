class AtendimentoController {
  constructor(service) {
    this.service = service;

    console.log("Métodos disponíveis no service:", Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
    console.log("Tipo de this.service:", typeof this.service);
    console.log("Tem listarAtendimentos?", typeof this.service.listarAtendimentos);

    this.listarAtendimentos = this.listarAtendimentos.bind(this);
    this.stats = this.stats.bind(this);
  }

  listarAtendimentos(req, res) {
    const atendimentos = this.service.listarAtendimentos();
    res.json(atendimentos);
  }

  stats(req, res) {
    const atendimentos = this.service.listarAtendimentos();
    const stats = {
      total: atendimentos.length,
      waiting: atendimentos.filter(a => a.status === "waiting").length,
      active: atendimentos.filter(a => a.status === "active").length,
      closed: atendimentos.filter(a => a.status === "closed").length,
      agentsOnline: this.service.model.agentesOnline.size,
    };
    res.json(stats);
  }
}

module.exports = AtendimentoController;
