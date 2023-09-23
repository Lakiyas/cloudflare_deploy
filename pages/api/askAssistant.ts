export const runtime = 'edge';

const headers = { 'Content-Type': 'application/json' };

const apiKey = process.env.PINECONE_API_KEY || '';
const environment = process.env.PINECONE_ENVIRONMENT || '';
const indexName = process.env.PINECONE_INDEX_NAME || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';

export async function makeChain(request: Request) {
  // console.log("makeLLMChain fn called");

  const body = await request.json();
  // console.log("req body:", body);

  const { question, history, locale } = body;
    // console.log(locale);

  if (!question) {
    // console.log("missing question");
    return new Response(JSON.stringify({ message: 'No question in the request' }), {
      status: 400,
      headers: headers,
    });
  }
  
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  let embedding;

  try {
    // console.log("generatig embeddings using the latest Ada L. embeddings model from OpenAI..");

    const openAIResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: sanitizedQuestion,
      }),
    });

    const openAIData = await openAIResponse.json();
    embedding = openAIData.data[0].embedding;
    // console.log("Embedding:", embedding);
  } catch (error) {
    console.log("Error getting embedding:", error);
    return new Response(JSON.stringify({ message: 'Error getting embedding', error }), {
      status: 500,
      headers: headers,
    });
  }

  try {
    console.log("Querying vectorstore...");

    const pineconeUrl = `https://${indexName}-3a512b1.svc.${environment}.pinecone.io/query`;
    const pineconeResponse = await fetch(pineconeUrl, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
        namespace: 'vision',
      }),
    });

    const queryResult = await pineconeResponse.json();
    // console.log("vectorstore query results:", queryResult);
    
    // extract relevant docs from vectorstoredb
    const context = queryResult.matches.length > 0 
    ? queryResult.matches.map((m: { metadata: { text: string } }) => m.metadata.text
    ).join(' \n ********** \n ## Next Context ## \n  Moving on to another relevant document: \n  ********** \n ')
    : "No context found";
    // console.log(context);
    
    const basicInstructions = locale === "en-us" ? 
    `You are an NSoft Vision customer support agent with a friendly and conversational tone. Given the following extracted parts of a long document and a question, provide a conversational answer based on your training and the context provided. Feel free to engage in small talk or answer questions about yourself, like a human would. The preferred Markdown syntax for a hyperlink is square brackets followed by parentheses - the square brackets hold the text, and the parentheses hold the link. Please try to reference the context below when providing hyperlinks, and refrain from creating random or irrelevant links. If the answer to the question isn't clear from the context provided, it's perfectly okay to say, "Based on the information I have, I couldn't find a direct answer. I would recommend searching the Help Center for more detailed information." ` 
    : `Vi ste agentica za korisničku podršku NSoft Vision. Dobivate sljedeće izvučene dijelove dugog dokumenta i pitanje. Dajte razgovorljiv odgovor temeljen na svojoj obuci i pruženom kontekstu, ali i sudjelujte u neformalnom razgovoru ili odgovarajte na pitanja o sebi, kao što bi to čovjek učinio, posebno na početku razgovora ukoliko vam se sugovornik obrati sa "Cao" ili "Bok", itd..
    Preferirana Markdown sintaksa za hipervezu su uglate zagrade koje slijede obične zagrade. Uglate zagrade sadrže tekst, a obične zagrade sadrže vezu. Pokušajte pružiti hiperveze koje se odnose na kontekst u nastavku i suzdržite se od stvaranja nasumičnih ili nevažnih veza. Odgovori neka budu kratki tako da navedete samo hiperveze do konteksta ispod. Ne pokušavajte izmisliti odgovor.
    Ako odgovor na pitanje nije jasan iz pruženog konteksta, u redu je reći, "Na temelju informacija koje imam, nisam mogla pronaći izravan odgovor. Preporučila bih pretraživanje Centra za pomoć za detaljnije informacije." `
    
    const commonSystemMessage = `${basicInstructions}
    \n Context: ${context}`;
    // Conditionally add the history part
    //  console.log("history len: ", history.length);
    const systemMessageContent = history.length ? `${commonSystemMessage} \n History: ${history}` : commonSystemMessage;
    //  console.log(systemMessageContent);
    
    const systemMessage = { role: "system", content: systemMessageContent };
    const userMessage = { role: "user", content: sanitizedQuestion };
    const messages = [systemMessage, userMessage];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          // model: history.length > 5 ? 'gpt-3.5-turbo-16k' : 'gpt-3.5-turbo',
          model: 'gpt-3.5-turbo',
          messages: messages, 
          temperature: 0,
        }),
      });
      
      const data = await response.json();
      // console.warn(data);
      // Extract the assistant's message
      const assistantMessage = data.choices[0]?.message?.content || '';
      
      
      return new Response(JSON.stringify({ assistantMessage, status: '[DONE]' }), {
        status: 200,
        headers: headers,
      });
      
    } catch (error) {
      console.log("Error occured in model processing:", error);
      return new Response(JSON.stringify({ message: 'Error occured in model processing', error }), {
        status: 500,
        headers: headers,
      });
    }
  } catch (error) {
    console.log("Error querying vectorstore:", error);
    return new Response(JSON.stringify({ message: 'Error querying vectorstore', error }), {
      status: 500,
      headers: headers,
    });
  }
}

export default async function handler(request: Request) {
  // console.log("default handler called");
  
  switch (request.method) {
    case 'POST':
      return makeChain(request);
    default:
      console.log("Unsupported method:", request.method);
      return new Response(JSON.stringify({ message: 'Method not supported' }), {
        status: 405,
        headers: headers,
      });
  }
}
