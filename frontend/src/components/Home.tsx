import { FiArrowRight, FiCode, FiLayout } from "react-icons/fi";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const handleGenerate =async () => {
    if (prompt.trim()) {
      navigate("/builder", { state: { prompt } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Website Builder AI
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Transform your ideas into a fully functional website with just a
            simple description
          </p>

          <div className="flex gap-6 justify-center mb-16">
            <div className="flex flex-col items-center p-6 bg-gray-800 rounded-lg">
              <FiCode className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Smart Code Generation
              </h3>
              <p className="text-gray-400">
                AI-powered code generation for your website
              </p>
            </div>
            <div className="flex flex-col items-center p-6 bg-gray-800 rounded-lg">
              <FiLayout className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
              <p className="text-gray-400">
                See your website come to life instantly
              </p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your website idea..."
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg mb-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
              rows={4}
            />
            <button
              onClick={handleGenerate}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 text-white px-8 py-3 rounded-lg font-semibold w-full hover:opacity-90 transition-opacity"
            >
              Generate Website <FiArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
