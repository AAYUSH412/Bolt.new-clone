# Bolt.new 🚀

AI-Powered Website Builder with Live Preview ⚡

## Overview 🌟

Bolt.new is a cutting-edge web application that transforms your ideas into functional websites using AI. Simply describe what you want, and watch as your website comes to life with live preview capabilities!

## Features ✨

- 🤖 AI-powered code generation
- 🎨 Live preview with WebContainer
- 📝 Real-time code editing
- 🔄 Instant file updates
- 💬 Interactive AI chat for modifications
- 🎯 Smart project structure generation

## Tech Stack 💻

- ⚛️ React
- 🎨 TailwindCSS
- 🧠 Claude AI
- 📦 WebContainer API
- 🔧 Monaco Editor
- ⚡ Vite

## Getting Started 🚀

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bolt.new.git
cd bolt.new
```

2. Install dependencies for both frontend and backend:
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. Set up environment variables:
   - Create a `.env.local` file in the backend directory
   - Add your Claude API key:
     ```
     CLAUDE_API_KEY=your-api-key-here
     PORT=3000
     ```

4. Start the development servers:
```bash
# Start backend server
cd backend
npm run dev

# In a new terminal, start frontend
cd frontend
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Project Structure 📁

```
bolt.new/
├── frontend/            # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/      # Custom React hooks
│   │   └── config/     # Configuration files
│   └── package.json
├── backend/            # Express backend server
│   ├── src/
│   │   ├── index.ts    # Server entry point
│   │   └── prompts/    # AI prompt templates
│   └── package.json
└── README.md
```

## Contributing 🤝

1. Fork the repository
2. Create a new branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Support 💪

If you found this project helpful, please consider giving it a ⭐️ on GitHub!

## Screenshots 📸

![Home Page](https://your-screenshot-url.com/home.png)
![Builder Interface](https://your-screenshot-url.com/builder.png)
