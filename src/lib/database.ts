import { PrismaClient } from "@prisma/client";
export const client = new PrismaClient();

type SaveToDBProps = {
  content: string;
  embedding: number[];  
  filePath: string;
  projectName: string;
  language?: string;
  functionName?: string;
  lineStart?: number;
  lineEnd?: number;
};

export const saveToDB = async (data: SaveToDBProps) => {
  try {
    const result = await client.codeSnippet.create({
      data: {
        ...data,
        embedding: data.embedding as any, 
      },
    });

    console.log("Saved to DB:", result.id);
    return result;

  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(`Error saving to DB: ${e.message}`);
    } else {
      console.error(`Unknown error saving to DB:`, e);
    }
  }
};


export const getfromDB = async (projectName: string) =>{
  try{
    const results =  await client.codeSnippet.findMany({
      where: {
        projectName: projectName
      }
    });

    console.log(`Found : ${results.length} snippets for project ${projectName}, returning all:
    ${results.map(r=>r.content)}}`)
    return results;
  }
  catch(e: unknown){
     if (e instanceof Error) {
      console.error(`Error saving to DB: ${e.message}`);
    } else {
      console.error(`Unknown error saving to DB:`, e);
    }
  }
}
