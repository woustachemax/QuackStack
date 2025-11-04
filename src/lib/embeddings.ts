import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const openai =  new OpenAI({
    apiKey: process.env.QUACKSTACK_OPENAI_API_KEY,
})

export async function getEmbeddings(content: string) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: content
    })
    // console.log("Embedding response:", response.data[0].embedding);
    return response.data[0].embedding;

}



// getEmbeddings("Hello, world! This is a test embedding.");