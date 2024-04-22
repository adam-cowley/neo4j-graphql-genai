import { RunnableSequence } from "@langchain/core/runnables"
import { PromptTemplate } from "@langchain/core/prompts"
import { ChatOpenAI } from "@langchain/openai"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { config } from "dotenv"
import { applyGenerateResolver } from "./generate.js";

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
  type GeneratedResponse {
    text: String!
  }

  type Movie  {
    title: String!
    plot: String!
    generateReview(stars: Int!): GeneratedResponse! @customResolver
  }


  type ActedIn @relationshipProperties {
    role: String
}

  type Actor {
    name: String!
    born: Date
    actedInMovies: [Movie!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: OUT)
  }
`;

// Generate a Review
const generateReview = async (source, args) => {
  const prompt = PromptTemplate.fromTemplate(`
    You are a sarcastic movie reviewer creating tongue-in-cheek
    reviews of movies.  Create a {stars} star movie review
    for {title}.

    The plot of the movie is: {plot}.

    Remember to use at least one pun or to include a dad joke.
  `)
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  const chain = RunnableSequence.from([
    prompt,
    llm,
    new StringOutputParser()
  ])

  const text = await chain.invoke({ ...source, ...args })

  return { text }
}


// Create schema
const neoSchema = new Neo4jGraphQL({ typeDefs, driver });

const schema = await neoSchema.getSchema()


const augmentedschema = applyGenerateResolver(schema)

console.log(schema);
// Create server
const server = new ApolloServer({
  schema,
  resolvers: {
    Movie: {
      generateReview,
    }
  },
});

// Listen
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({ req }),
  listen: { port: 4000 },
});

console.log(`🚀 Server ready at ${url}`);