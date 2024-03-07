import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { NextResponse } from 'next/server'
import { clerkClient, currentUser } from '@clerk/nextjs'

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge'
// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse('Missing OpenAI API Key.', { status: 400 })
    }

    const user = await currentUser()

    if (!user) {
      return new NextResponse('You need to sign in first.', { status: 401 })
    }

    const credits = Number(user.publicMetadata?.credits || 0)

    if (!credits) {
      return new NextResponse('You have no credits left.', { status: 402 })
    }

    const { messages } = await req.json()
    // Ask OpenAI for a streaming chat completion given the prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      stream: true,
      messages
    })

    // Deduct credits
    await clerkClient.users.updateUserMetadata(user.id, {
      publicMetadata: {
        credits: credits - 1
      }
    })

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(response)
    // Respond with the stream
    return new StreamingTextResponse(stream)
  } catch (error: any) {
    return new NextResponse(error.message || 'Something went wrong!', {
      status: 500
    })
  }
}
