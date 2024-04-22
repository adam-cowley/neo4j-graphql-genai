import { GraphQLSchema, visit } from "graphql"

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


/**
 *
 * @param {require("graphql").GraphQLSchema} schema
 * @returns {require("graphql").GraphQLSchema}
 */
export const applyGenerateResolver = (schema) => {



  return visit(schema, {
    enter: (node, key, parent, path, ancestors) => {
      console.log('>>', key);

      try {
        node.fields.push({
          kind: 'FieldDefinition',
          name: {
            kind: 'Name',
            value: 'Generate',
          },
        })
      }
      catch(e) {}

      // if (node.kind === "ObjectTypeDefinition") {
      //   const implementsCanGenerate = node.interfaces.some(
      //     iface => iface.name.value === "CanGenerate"
      //   )


      //   if (implementsCanGenerate) {
      //     return {
      //       ...node,
      //       // fields: [
      //       //   ...node.fields,
      //       //   {
      //       //     kind: 'FieldDefinition',
      //       //     name: {
      //       //       kind: 'Name',
      //       //       value: 'Generate',
      //       //     },
      //       //   },
      //       //   {
      //       //     kind: 'NamedType',
      //       //     name: {
      //       //       kind: 'Name',
      //       //       value: 'string',
      //       //     },
      //       //   },
      //       // ]
      //     }
      //   }

      //   return node
      // }
    }
  })
}
