require("dotenv").config({ path: ".env.local" });
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import { getSystemPrompt, BASE_PROMPT } from "./prompts";
import { Baseprompt as nextjsBaseprompt } from "./defaults/nextjs";
import { Baseprompt as reactBaseprompt } from "./defaults/React";
import express, { Express, Request, Response } from "express";
import { TextBlockParam } from "@anthropic-ai/sdk/resources";
import { text } from "stream/consumers";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const app: Express = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Cross-Origin-Embedder-Policy', 'Cross-Origin-Opener-Policy']
}));
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.post(
  "/template",
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Get prompt from request body
      const { prompt } = req.body;

      // Validate prompt
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const response = await anthropic.messages.create({
        messages: [{ role: "user", content: prompt }], // Use prompt directly
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 200,
        system: "Return either nextjs or react based on what do you think this project should be. Only return a single word either 'nextjs' or 'react'. Do not return anything extra.",
      });

      const answer = (response.content[0] as TextBlockParam).text;

      if (answer === "react") {
        const responseData = {
          prompts: [BASE_PROMPT, reactBaseprompt],
          uiprompt: reactBaseprompt,
          message: "react",
        };
        return res.json(responseData);
      } else if (answer === "nextjs") {
        const responseData = {
          prompts: [nextjsBaseprompt],
          uiprompt: nextjsBaseprompt,
          message: "nextjs",
        };
        return res.json(responseData);
      } else {
        return res.status(500).json({ error: "Unexpected response from AI" });
      }
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/chat", async (req, res) => {
  try {
    const messages = req.body.messages;
    const response = await anthropic.messages.create({
      messages: messages,
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system: getSystemPrompt(),
    });

    // Send the content back to the client
    res.json({
      content: (response.content[0] as TextBlockParam)?.text // Changed from 'response' to 'content'
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const anthropic = new Anthropic({
  // defaults to process.env["ANTHROPIC_API_KEY"]
  apiKey: CLAUDE_API_KEY,
});

// async function main() {
//   anthropic.messages
//     .stream({
//       messages: [
//         {
//           role: "user",
//           content:
//             "For all designs I ask you to make, have them be beautiful, not cookie cutter. Make webpages that are fully featured and worthy for production.\n\nBy default, this template supports JSX syntax with Tailwind CSS classes, React hooks, and Lucide React for icons. Do not install other packages for UI themes, icons, etc unless absolutely necessary or I request them.\n\nUse icons from lucide-react for logos.\n\nUse stock photos from unsplash where appropriate, only valid URLs you know exist. Do not download the images, only link to them in image tags.",
//         },
//         {
//           role: "user",
//           content:
//             "Project Files:\n\nThe following is a list of all project files and their complete contents that are currently visible and accessible to you.\n\n{{Baseprompt}}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n  - .bolt/prompt",
//         },
//         {
//           role: "user",
//           content:
//             "<bolt_running_commands>\n</bolt_running_commands>\n\nCurrent Message:\n\ncreate a simple hello world in react\n\nFile Changes:\n\nHere is a list of all files that have been modified since the start of the conversation.\nThis information serves as the true contents of these files!\n\nThe contents include either the full file contents or a diff (when changes are smaller and localized).\n\nUse it to:\n - Understand the latest file modifications\n - Ensure your suggestions build upon the most recent version of the files\n - Make informed decisions about changes\n - Ensure suggestions are compatible with existing code\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - /home/project/.bolt/config.json",
//         },
//       ],
//       model: "claude-3-5-sonnet-20241022",
//       max_tokens: 8000,
//       system: "Return either nextjs or react based on what do you think this project should be.Only return a single word either 'nextjs' or 'react'.Do not return anything extra."
//     })
//     .on("text", (text) => {
//       console.log(text);
//     });
// }

// main();


