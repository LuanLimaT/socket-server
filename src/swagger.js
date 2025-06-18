const swaggerJsdoc = require("swagger-jsdoc")
const swaggerUi = require("swagger-ui-express")
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Atendimento Socket Server",
      version: "1.0.0",
      description: "Documentação da API REST do servidor de atendimento",
    },
    servers: [
      {
        url: "http://localhost:3002",
      },
    ],
  },
  apis: [path.resolve(__dirname, "./routes/*.js")], 
}

const swaggerSpec = swaggerJsdoc(options)

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}

module.exports = setupSwagger
