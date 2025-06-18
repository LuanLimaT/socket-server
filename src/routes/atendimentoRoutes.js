const express = require("express");

/**
 * @swagger
 * tags:
 *   name: Atendimentos
 *   description: Rotas para gerenciar atendimentos
 */

module.exports = (controller) => {
  const router = express.Router();

  /**
   * @swagger
   * /atendimentos:
   *   get:
   *     summary: Lista todos os atendimentos
   *     tags: [Atendimentos]
   *     responses:
   *       200:
   *         description: Lista de atendimentos
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "123"
   *                   clientName:
   *                     type: string
   *                     example: "João Silva"
   *                   status:
   *                     type: string
   *                     enum: [waiting, active, closed]
   *                     example: "active"
   *                   unreadCount:
   *                     type: integer
   *                     example: 3
   *                   startedAt:
   *                     type: string
   *                     format: date-time
   *                     example: "2025-06-18T15:00:00Z"
   */

  router.get("/", controller.listarAtendimentos);

  /**
   * @swagger
   * /atendimentos/stats:
   *   get:
   *     summary: Retorna estatísticas dos atendimentos
   *     tags: [Atendimentos]
   *     responses:
   *       200:
   *         description: Estatísticas de atendimentos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalAtendimentos:
   *                   type: integer
   *                   example: 25
   *                 totalAgentes:
   *                   type: integer
   *                   example: 5
   */

  router.get("/stats", controller.stats);

  return router;
};
