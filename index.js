import { RunnableSequence } from "@langchain/core/runnables"
import { PromptTemplate } from "@langchain/core/prompts"
import { ChatOpenAI } from "@langchain/openai"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { config } from "dotenv"

// Load .env file
config()

// Create driver instance
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

// Type Defs
const typeDefs = `
  interface CanGenerate {
    generate(prompt: String!): GeneratedResponse!
  }

  type GeneratedResponse {
    text: String!
  }

  type Movie implements CanGenerate {
    title: String!
    plot: String!
    generate(prompt: String!): GeneratedResponse! @customResolver
  }


  type ActedIn @relationshipProperties {
    role: String
}

  type Actor implements CanGenerate {
    name: String!
    born: Date
    actedInMovies: [Movie!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: OUT)


    generate(prompt: String!): GeneratedResponse! @customResolver
  }
`;

// Generate function
const generate = async (source, args) => {
  const prompt = PromptTemplate.fromTemplate(args.prompt)
  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    model: args.model
  })
  const output = new StringOutputParser()

  const chain = RunnableSequence.from([
    prompt,
    model,
    output,
  ])

  const input = Object.fromEntries(
      Object.entries({...source, ...args}
    )
    .map(([ key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : value
    ]))

  const res = await chain.invoke(input)

  return { text: res }
}

const resolvers = {
  Movie: {
    generate,
  },
  Actor: {
    generate,
  },
};

// Assign resolver to many types
const withGenerateResolver = (types = []) =>
  Object.fromEntries(
    types.map(type => [
      type,
      { generate }
    ])
  )

  // Define schema
const neoSchema = new Neo4jGraphQL({
    typeDefs,
    driver,
    resolvers: withGenerateResolver(['Movie', 'Actor']),
});

// Create server
const server = new ApolloServer({
  schema: await neoSchema.getSchema(),
  resolvers,
});

// Listen
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({ req }),
  listen: { port: 4000 },
});

console.log(`🚀 Server ready at ${url}`);