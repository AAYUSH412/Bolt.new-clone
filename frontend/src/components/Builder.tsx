import { useState, useEffect, use } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { parseXml } from "../steps";
import {
  FileIcon,
  FolderIcon,
  ChevronDown,
  ChevronRight,
  Code,
  Eye,
  ArrowLeft,
  Terminal,
  Package,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from "lucide-react";
import { useWebcontainer } from "../hooks/useWebcontainer";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
}

enum Steptype {
  Createfile = "Createfile",
  Updatefile = "Updatefile",
  Deletefile = "Deletefile",
  Installpackage = "Installpackage",
  Runcommand = "Runcommand",
}

interface Step {
  title: string;
  description: string;
  type: Steptype;
  status: "pending" | "processing" | "completed" | "error";
  code?: string;
  error?: string;
}

const Builder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prompt = location.state?.prompt;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [fileContent, setFileContent] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [xmlResponse, setXmlResponse] = useState<string>("");
  const [isEditorLoading, setIsEditorLoading] = useState(true);
  const [areFilesLoaded, setAreFilesLoaded] = useState(false);
  const [isWebContainerMounted, setIsWebContainerMounted] = useState(false);
  const [isWebContainerLoading, setIsWebContainerLoading] = useState(false);
  const [webContainerFiles, setWebContainerFiles] = useState<
    Record<string, any>
  >({});
  const { webcontainer, webContainerUrl, setWebContainerUrl } = useWebcontainer();
  const [url, seturl] = useState("");
  const [introMessage, setIntroMessage] = useState<string | null>(null);
  const [outroMessage, setOutroMessage] = useState<string | null>(null);
  const [userprompt, setprompt] = useState("");
  const [llmmessage, setllmmessage] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Get status icon based on step status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // Render steps in card format
  // In Builder.tsx, in the renderSteps function
  const renderSteps = () => {
    return steps.map((step, index) => (
      <div
        key={index}
        className={`p-4 mb-4 rounded-xl border transition-all shadow-md ${
          step.status === "completed"
            ? "border-green-500/20 bg-gradient-to-br from-green-900/10 to-green-600/5"
            : step.status === "processing"
            ? "border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-blue-600/5"
            : step.status === "error"
            ? "border-red-500/20 bg-gradient-to-br from-red-900/10 to-red-600/5"
            : "border-gray-800 bg-gradient-to-br from-gray-900/50 to-gray-800/30"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
          <div className="flex-grow">
            <div className="flex items-center gap-2">
              {getStepIcon(step.type)}
              <h3 className="font-medium text-base">{step.title}</h3>
            </div>
          </div>
        </div>

        {/* Show file path for file creation steps */}
        {step.type === Steptype.Createfile &&
          step.title.startsWith("Create") && (
            <div className="mt-2 text-xs flex items-center">
              <FileIcon className="w-3 h-3 mr-1 opacity-60" />
              <span className="text-blue-400">
                {step.title.replace("Create ", "")}
              </span>
            </div>
          )}

        {/* Show code for shell commands */}
        {step.type === Steptype.Runcommand && step.code && (
          <div className="mt-3 bg-black/40 p-3 rounded-md text-xs font-mono border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs">
              <Terminal className="w-3 h-3" />
              <span>Shell command</span>
            </div>
            <div className="text-gray-300">$ {step.code}</div>
          </div>
        )}

        {/* Show installation commands */}
        {step.type === Steptype.Installpackage && step.code && (
          <div className="mt-3 bg-black/40 p-3 rounded-md text-xs font-mono border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs">
              <Package className="w-3 h-3" />
              <span>Package installation</span>
            </div>
            <div className="text-gray-300">$ {step.code}</div>
          </div>
        )}

        {/* Show error messages if any */}
        {step.error && (
          <div className="mt-3 text-xs text-red-400 bg-red-900/20 p-2 rounded-md border border-red-900/20">
            {step.error}
          </div>
        )}
      </div>
    ));
  };

  const processFiles = (xmlContent: string): FileNode[] => {
    const fileRegex =
      /<boltAction type="file" filePath="([^"]+)">([^]*?)<\/boltAction>/g;
    const fileMap = new Map<string, FileNode>();
    const rootFolders = new Set<string>();
    let match;

    while ((match = fileRegex.exec(xmlContent)) !== null) {
      const [, filePath, content] = match;
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop() || "";

      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        type: "file",
        content: content.trim(),
      };

      fileMap.set(filePath, fileNode);
      if (pathParts.length > 0) {
        rootFolders.add(pathParts[0]);
      }
    }

    // Create folder structure
    const result: FileNode[] = [];
    rootFolders.forEach((rootFolder) => {
      const rootNode: FileNode = {
        name: rootFolder,
        path: rootFolder,
        type: "directory",
        children: [],
      };

      fileMap.forEach((node, path) => {
        if (path.startsWith(rootFolder + "/")) {
          const pathParts = path.split("/");
          let currentLevel = rootNode;

          for (let i = 1; i < pathParts.length - 1; i++) {
            const folderName = pathParts[i];
            let folder = currentLevel.children?.find(
              (child) => child.type === "directory" && child.name === folderName
            );

            if (!folder) {
              folder = {
                name: folderName,
                path: pathParts.slice(0, i + 1).join("/"),
                type: "directory",
                children: [],
              };
              currentLevel.children = currentLevel.children || [];
              currentLevel.children.push(folder);
            }
            currentLevel = folder;
          }

          currentLevel.children = currentLevel.children || [];
          currentLevel.children.push(node);
        }
      });

      result.push(rootNode);
    });

    fileMap.forEach((node, path) => {
      if (!path.includes("/")) {
        result.push(node);
      }
    });

    return result;
  };

  const init = async () => {
    if (!prompt) return;

    try {
      setIsProcessing(true);
      setError(null);
      setIsEditorLoading(true);

      // Start with initial analysis step
      setSteps([
        {
          title: "Analyzing Requirements",
          description: "Processing your request...",
          type: Steptype.Createfile,
          status: "processing",
        },
      ]);

      // Get template
      const templateResponse = await axios.post(`${BACKEND_URL}/template`, {
        prompt: prompt.trim(),
      });

      const { prompts, uiprompt } = templateResponse.data;

      // Update first step and add template steps - but just use as initial setup
      const templateSteps = parseXml(uiprompt);

      // Process template files
      const templateFiles = processFiles(uiprompt);
      setFiles(templateFiles);

      // Get chat response with retries for rate limit
      const getClaudeResponse = async (
        retries = 3,
        delay = 1000
      ): Promise<any> => {
        try {
          const response = await axios.post(`${BACKEND_URL}/chat`, {
            messages: [...prompts, prompt].map((content) => ({
              role: "user",
              content,
            })),
          });

          const responseContent =
            response.data.content || response.data.response;

          setllmmessage(
            [...prompts, prompt].map((content) => ({
              role: "user",
              content,
            }))
          );

          setllmmessage((x) => [
            ...x,
            { role: "assistant", content: responseContent },
          ]);
          console.log(llmmessage);

          // Extract the introduction message before the boltArtifact
          const introBeforeMatch = responseContent.match(
            /^(.*?)(?=<boltArtifact|$)/s
          );
          const introBefore =
            introBeforeMatch && introBeforeMatch[0].trim()
              ? introBeforeMatch[0].trim()
              : "";

          // Extract any text after the boltArtifact
          const introAfterMatch = responseContent.match(
            /<\/boltArtifact>(.*?)$/s
          );
          const introAfter =
            introAfterMatch && introAfterMatch[1].trim()
              ? introAfterMatch[1].trim()
              : "";

          // Set the intro message
          if (introBefore) {
            setIntroMessage(introBefore);
          }

          // Set the outro message
          if (introAfter) {
            setOutroMessage(introAfter);
          }

          return response;
        } catch (error: any) {
          if (error.response?.status === 429 && retries > 0) {
            // Rate limit hit - wait and retry
            const retryAfter = error.response.headers?.["retry-after"]
              ? parseInt(error.response.headers["retry-after"]) * 1000
              : delay;

            await new Promise((r) => setTimeout(r, retryAfter));
            return getClaudeResponse(retries - 1, delay * 2);
          }
          throw error;
        }
      };

      const chatResponse = await getClaudeResponse();
      const responseContent =
        chatResponse.data.content || chatResponse.data.response;
      setXmlResponse(responseContent);

      if (responseContent) {
        // Replace all steps with the chat response steps
        const newSteps = parseXml(responseContent);

        // Update the first "Analyzing Requirements" step to completed
        setSteps([
          {
            title: "Analyzing Requirements",
            description: "Processing your request...",
            type: Steptype.Createfile,
            status: "completed",
          },
          ...newSteps,
        ]);

        // Process files from chat response
        const chatFiles = processFiles(responseContent);

        // Merge files instead of replacing
        setFiles((prevFiles) => {
          const newFileMap = new Map<string, FileNode>();

          // Add existing files to map
          const addNodeToMap = (node: FileNode) => {
            if (node.type === "file") {
              newFileMap.set(node.path, node);
            } else if (node.children) {
              node.children.forEach(addNodeToMap);
            }
          };
          prevFiles.forEach(addNodeToMap);

          // Add new files, overwriting duplicates
          chatFiles.forEach(addNodeToMap);

          // Rebuild tree structure
          return processFiles(
            [...newFileMap.values()]
              .map(
                (node) =>
                  `<boltAction type="file" filePath="${node.path}">${node.content}</boltAction>`
              )
              .join("\n")
          );
        });

        // Auto-select first file if none selected
        if (!selectedFile && chatFiles.length > 0) {
          const findFirstFile = (nodes: FileNode[]): string | null => {
            for (const node of nodes) {
              if (node.type === "file") return node.path;
              if (node.children && node.children.length > 0) {
                const filePath = findFirstFile(node.children);
                if (filePath) return filePath;
              }
            }
            return null;
          };

          const firstFile = findFirstFile(chatFiles);
          if (firstFile) {
            setSelectedFile(firstFile);
            const fileNode = chatFiles.find((f) => f.path === firstFile);
            if (fileNode) setFileContent(fileNode.content || "");
          }
        }
      }
    } catch (error: any) {
      console.error("Error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "An error occurred";
      setError(errorMessage);
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: "error",
          error: errorMessage,
        }))
      );
    } finally {
      setIsProcessing(false);
      setIsEditorLoading(false);
      setAreFilesLoaded(true);
    }
  };

  useEffect(() => {
    if (prompt) {
      init();
    }
  }, [prompt]);

  useEffect(() => {
    if (selectedFile) {
      setIsEditorLoading(true);
      const findFileContent = (nodes: FileNode[]): string | undefined => {
        for (const node of nodes) {
          if (node.path === selectedFile && node.type === "file") {
            return node.content;
          }
          if (node.children) {
            const content = findFileContent(node.children);
            if (content) return content;
          }
        }
        return undefined;
      };

      const content = findFileContent(files);
      if (content) setFileContent(content);

      // Small delay to show loading state
      setTimeout(() => {
        setIsEditorLoading(false);
      }, 300);
    }
  }, [selectedFile, files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getStepIcon = (type: Steptype) => {
    switch (type) {
      case Steptype.Createfile:
        return <FileIcon className="w-4 h-4 text-blue-400" />;
      case Steptype.Installpackage:
        return <Package className="w-4 h-4 text-purple-400" />;
      case Steptype.Runcommand:
        return <Terminal className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  };

  const getFileLanguage = (filePath: string) => {
    if (!filePath) return "plaintext";

    const extension = filePath.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
        return "javascript";
      case "jsx":
        return "javascript";
      case "ts":
        return "typescript";
      case "tsx":
        return "typescript";
      case "html":
        return "html";
      case "css":
        return "css";
      case "json":
        return "json";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${level * 12}px` }}>
        <button
          className={`flex items-center w-full p-1.5 text-sm rounded-md transition-colors
            ${
              selectedFile === node.path
                ? "bg-blue-500/20 text-blue-400"
                : "hover:bg-gray-800"
            }`}
          onClick={() => {
            if (node.type === "directory") {
              toggleFolder(node.path);
            } else {
              setSelectedFile(node.path);
              setFileContent(node.content || "");
            }
          }}
        >
          <span className="mr-2">
            {node.type === "directory" ? (
              expandedFolders.has(node.path) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <FileIcon className="w-4 h-4 text-gray-400" />
            )}
          </span>
          {node.name}
        </button>
        {node.type === "directory" &&
          expandedFolders.has(node.path) &&
          node.children && (
            <div className="mt-1">
              {renderFileTree(node.children, level + 1)}
            </div>
          )}
      </div>
    ));
  };

  const createWebContainerFileStructure = (
    nodes: FileNode[]
  ): Record<string, any> => {
    const fileSystem: Record<string, any> = {};

    // Helper function to recursively process nodes
    const processNode = (node: FileNode) => {
      if (node.type === "file") {
        // Create a file entry
        const pathParts = node.path.split("/");

        // Handle root-level files
        if (pathParts.length === 1) {
          fileSystem[node.path] = {
            file: {
              contents: node.content || "",
            },
          };
          return;
        }

        // Handle nested files by recursively building the directory structure
        let current = fileSystem;
        const fileName = pathParts.pop() || "";
        let currentPath = "";

        for (const part of pathParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;

          // Create directory if it doesn't exist
          if (!current[part]) {
            current[part] = {
              directory: {},
            };
          }

          current = current[part].directory;
        }

        // Add the file at the current level
        current[fileName] = {
          file: {
            contents: node.content || "",
          },
        };
      } else if (node.type === "directory" && node.children) {
        // Process each child in the directory
        // First ensure the directory exists
        const dirPath = node.path;
        const pathParts = dirPath.split("/");

        let current = fileSystem;
        let currentPath = "";

        for (const part of pathParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;

          if (!current[part]) {
            current[part] = {
              directory: {},
            };
          }

          current = current[part].directory;
        }

        // Process all children
        node.children.forEach((child) => {
          processNode(child);
        });
      }
    };

    // Process each root node
    nodes.forEach((node) => {
      processNode(node);
    });

    return fileSystem;
  };

  const mountFilesToWebContainer = async (): Promise<boolean> => {
    if (!webcontainer || files.length === 0) {
      console.log("WebContainer not ready or no files to mount");
      return false;
    }

    try {
      setIsWebContainerLoading(true);
      console.log("Starting WebContainer file mounting...");

      // Convert FileNode tree to WebContainer format
      const fileSystem = createWebContainerFileStructure(files);

      // Kill any existing processes
      try {
        await webcontainer.spawn("pkill", ["-f", "node"]);
      } catch (error) {
        // Ignore errors here
      }

      // Mount the file system
      await webcontainer.mount(fileSystem);
      setWebContainerFiles(fileSystem);

      console.log("Files successfully mounted to WebContainer!");
      setIsWebContainerMounted(true);
      setIsWebContainerLoading(false);
      return true;
    } catch (error) {
      console.error("Error mounting files to WebContainer:", error);
      setError(
        "Failed to mount files to WebContainer: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
      setIsWebContainerLoading(false);
      return false;
    }
  };

  const remountFilesToWebContainer = async (): Promise<boolean> => {
    if (!webcontainer || files.length === 0) {
      console.log("WebContainer not ready or no files to mount");
      return false;
    }
  
    try {
      setIsWebContainerLoading(true);
      console.log("Remounting files to WebContainer after update...");
  
      // Convert FileNode tree to WebContainer format
      const fileSystem = createWebContainerFileStructure(files);
  
      // Clear the preview URL first
      setWebContainerUrl(null);
  
      // Kill any running processes before remounting
      try {
        await webcontainer.spawn("pkill", ["-f", "node"]);
      } catch (error) {
        // Ignore errors here as there might not be any processes to kill
      }
  
      // Reset WebContainer mount state
      setIsWebContainerMounted(false);
  
      // Mount the new file system
      await webcontainer.mount(fileSystem);
  
      // Store the file structure for reference
      setWebContainerFiles(fileSystem);
      
      console.log("Files successfully remounted to WebContainer!");
      
      // Set mounted state and run dev server
      setIsWebContainerMounted(true);
      await runDevServer();
  
      setIsWebContainerLoading(false);
      return true;
    } catch (error) {
      console.error("Error remounting files to WebContainer:", error);
      setError("Failed to remount files to WebContainer: " + (error instanceof Error ? error.message : "Unknown error"));
      setIsWebContainerLoading(false);
      return false;
    }
  };

  const runDevServer = async () => {
    if (!webcontainer || !isWebContainerMounted) {
      console.log(
        "Cannot run dev server - WebContainer not ready or files not mounted"
      );
      return;
    }

    try {
      console.log("Starting development process in WebContainer...");

      // Kill any running processes (important for reruns)
      try {
        await webcontainer.spawn("pkill", ["-f", "node"]);
      } catch (error) {
        // Ignore errors here as there might not be any processes to kill
        console.log("No processes to kill or error killing processes");
      }

      // Install dependencies first
      console.log("Installing dependencies...");
      const installProcess = await webcontainer.spawn("npm", ["install"]);

      // Wait for installation to complete
      const installExitCode = await installProcess.exit;
      console.log(
        `Dependencies installation completed with exit code: ${installExitCode}`
      );

      if (installExitCode !== 0) {
        console.error("Failed to install dependencies");
        return;
      }

      // Once dependencies are installed, start the dev server
      console.log("Starting development server...");
      const devProcess = await webcontainer.spawn("npm", ["run", "dev"]);

      // Log output from the dev process
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log(`[WebContainer Dev Server]: ${data}`);
          },
        })
      );

      console.log("Development server process started");
    } catch (error) {
      console.error("Error running dev server in WebContainer:", error);
    }
  };

  useEffect(() => {
    if (
      webcontainer &&
      files.length > 0 &&
      areFilesLoaded &&
      !isWebContainerMounted
    ) {
      console.log(
        "Files are fully loaded in editor, mounting to WebContainer..."
      );

      // Mount files to WebContainer first and don't call runDevServer here
      mountFilesToWebContainer();
    }
  }, [webcontainer, files, areFilesLoaded, isWebContainerMounted]);

  // Add a separate effect that runs the dev server when isWebContainerMounted changes to true
  useEffect(() => {
    if (webcontainer && isWebContainerMounted) {
      console.log("WebContainer is mounted, running dev server...");
      runDevServer();
    }
  }, [webcontainer, isWebContainerMounted]);

  // Add listener for WebContainer URL
  useEffect(() => {
    if (webContainerUrl) {
      console.log("🚀 WebContainer server running at:", webContainerUrl);
      console.log(`Server port: ${new URL(webContainerUrl).port}`);
      seturl(webContainerUrl); // Set url to webContainerUrl
      console.log(webContainerUrl);
    }
  }, [webContainerUrl]);

  // Add a watcher for file changes
  useEffect(() => {
    if (areFilesLoaded && isWebContainerMounted && !isWebContainerLoading) {
      console.log("Files changed, remounting to WebContainer...");
      remountFilesToWebContainer();
    }
  }, [files]); // Watch for changes in the files array

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="h-14 border-b border-gray-800 flex items-center px-6 bg-gray-950/70 backdrop-blur-sm fixed top-0 left-0 right-0 z-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </button>

        <div className="flex-1 text-center">
          <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 font-bold">
            Bolt.new Builder
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {error && <span className="text-red-400 text-sm">{error}</span>}

          <button
            onClick={() => init()}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md ${
              isProcessing
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex pt-14 min-h-screen">
        {/* Steps Panel */}
        <section
          aria-label="Build Steps"
          className="flex flex-col w-96 py-6 border-r border-gray-800/50 bg-gradient-to-b from-gray-950 to-gray-900 h-screen sticky top-14"
        >
          <div className="mx-6">
            <h2 className="text-lg font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 sticky top-0  py-2 z-10">
              Build Steps
            </h2>

            {/* User Prompt Card */}
            <div className="overflow-y-auto pr-2 max-h-[calc(100vh-12rem)] scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
              {/* User Prompt Card */}
              <div className="relative flex flex-col mb-5 rounded-xl overflow-auto bg-gray-800/40">
                <div className="flex gap-4 p-4 w-full">
                  <div className="flex select-none items-center justify-center size-8 overflow-hidden rounded-full shrink-0 bg-blue-600 text-white">
                    <span className="font-semibold">U</span>
                  </div>
                  <div className="grid grid-col-1 w-full">
                    <div className="overflow-hidden py-1">
                      <p className="text-gray-200 text-sm">
                        {prompt || "No prompt provided."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Claude's Introduction - new code */}
              {introMessage && (
                <div className="relative flex flex-col mb-5 rounded-xl overflow-auto bg-gray-800/20">
                  <div className="flex gap-4 p-4 w-full">
                    <div className="flex select-none items-center justify-center size-8 overflow-hidden rounded-full shrink-0 bg-purple-600 text-white">
                      <span className="font-semibold">C</span>
                    </div>
                    <div className="grid grid-col-1 w-full">
                      <div className="overflow-hidden py-1">
                        <p className="text-gray-200 text-sm">{introMessage}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps Cards */}
              {steps.length > 0 ? (
                <div className="space-y-6">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="relative flex flex-col rounded-xl overflow-auto"
                      style={{
                        background:
                          "linear-gradient(var(--bolt-elements-messages-background, #1e293b) max(calc(100% - 100vh), 30%), var(--bolt-elements-messages-background, #1e293b) 100%)",
                      }}
                    >
                      <div className="rounded-xl overflow-hidden border border-gray-700/50">
                        <div className="flex items-center gap-3 p-3 border-b border-gray-700/30 bg-gray-800/40">
                          <div className="flex-shrink-0">
                            {getStatusIcon(step.status)}
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center gap-2">
                              {getStepIcon(step.type)}
                              <h3 className="font-medium text-base">
                                {step.title}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-gray-900/40">
                          {/* Show file path for file creation steps */}
                          {step.type === Steptype.Createfile &&
                            step.title.startsWith("Create") && (
                              <div className="mb-2 text-xs flex items-center">
                                <FileIcon className="w-3 h-3 mr-1 opacity-60" />
                                <code className="select-text bg-gray-800/70 px-1.5 py-1 rounded-md break-all text-blue-400">
                                  {step.title.replace("Create ", "")}
                                </code>
                              </div>
                            )}

                          {/* Show code for shell commands */}
                          {step.type === Steptype.Runcommand && step.code && (
                            <div className="mt-1 text-xs">
                              <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs">
                                <Terminal className="w-3 h-3" />
                                <span>Shell command</span>
                              </div>
                              <div className="text-xs border border-gray-700/50 overflow-auto rounded-lg w-full mt-1">
                                <pre className="bg-gray-900 p-2 text-gray-300">
                                  $ {step.code}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Show installation commands */}
                          {step.type === Steptype.Installpackage &&
                            step.code && (
                              <div className="mt-1 text-xs">
                                <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs">
                                  <Package className="w-3 h-3" />
                                  <span>Package installation</span>
                                </div>
                                <div className="text-xs border border-gray-700/50 overflow-auto rounded-lg w-full mt-1">
                                  <pre className="bg-gray-900 p-2 text-gray-300">
                                    $ {step.code}
                                  </pre>
                                </div>
                              </div>
                            )}

                          {/* Show error messages if any */}
                          {step.error && (
                            <div className="mt-3 text-xs text-red-400 bg-red-900/20 p-2 rounded-md border border-red-900/20">
                              {step.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Claude's Explanation - after artifact */}
                  {outroMessage &&
                    steps.some((step) => step.status === "completed") && (
                      <div className="relative flex flex-col mt-8 mb-4 rounded-xl overflow-auto bg-gray-800/20">
                        <div className="flex gap-4 p-4 w-full">
                          <div className="flex select-none items-center justify-center size-8 overflow-hidden rounded-full shrink-0 bg-purple-600 text-white">
                            <span className="font-semibold">C</span>
                          </div>
                          <div className="grid grid-col-1 w-full">
                            <div className="overflow-hidden py-1">
                              <p className="text-gray-200 text-sm whitespace-pre-wrap">
                                {outroMessage}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border border-gray-800 rounded-xl bg-gray-900/50">
                  <Loader2 className="w-8 h-8 text-gray-600 animate-spin mb-2" />
                  <p className="text-gray-500">Loading steps...</p>
                </div>
              )}
            </div>

            <div className=" mt-4 border-t border-gray-800/50 pt-4 sticky bottom-0">
              <div className="relativebg-black/30 backdrop-blur-sm ">
                <textarea
                  value={userprompt}
                  onChange={(e) => {
                    setprompt(e.target.value);
                  }}
                  placeholder="Ask a follow-up question..."
                  className="w-full resize-none bg-gray-800/50 border border-gray-700/50 rounded-lg py-2 px-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
                <button
                  onClick={async () => {
                    if (!userprompt.trim()) return;

                    try {
                      setIsProcessing(true);
                      setError(null);

                      const newMessage = {
                        role: "user" as const,
                        content: userprompt,
                      };

                      const stepsResponse = await axios.post(
                        `${BACKEND_URL}/chat`,
                        {
                          messages: [...llmmessage, newMessage],
                        }
                      );

                      // Update message history
                      setllmmessage((prev) => [...prev, newMessage]);

                      const responseContent =
                        stepsResponse.data.content ||
                        stepsResponse.data.response;
                      setXmlResponse(responseContent);

                      // Add assistant message to history
                      setllmmessage((prev) => [
                        ...prev,
                        {
                          role: "assistant" as const,
                          content: responseContent,
                        },
                      ]);

                      // Extract intro and outro messages
                      const introBeforeMatch = responseContent.match(
                        /^(.*?)(?=<boltArtifact|$)/s
                      );
                      const introBefore =
                        introBeforeMatch && introBeforeMatch[0].trim()
                          ? introBeforeMatch[0].trim()
                          : "";

                      const introAfterMatch = responseContent.match(
                        /<\/boltArtifact>(.*?)$/s
                      );
                      const introAfter =
                        introAfterMatch && introAfterMatch[1].trim()
                          ? introAfterMatch[1].trim()
                          : "";

                      // Update intro/outro messages
                      if (introBefore) {
                        setIntroMessage(introBefore);
                      }

                      if (introAfter) {
                        setOutroMessage(introAfter);
                      }

                      // Process new steps
                      if (
                        responseContent &&
                        responseContent.includes("<boltAction")
                      ) {
                        const newSteps = parseXml(responseContent);

                        // Add follow-up step
                        setSteps((prev) => [
                          ...prev,
                          {
                            title: "Follow-up Response",
                            description: "Processing your follow-up request...",
                            type: Steptype.Createfile,
                            status: "completed",
                          },
                          ...newSteps,
                        ]);

                        // Process files from follow-up response
                        const followUpFiles = processFiles(responseContent);

                        // Merge files with existing ones
                        setFiles((prevFiles) => {
                          const newFileMap = new Map<string, FileNode>();

                          // Add existing files to map
                          const addNodeToMap = (node: FileNode) => {
                            if (node.type === "file") {
                              newFileMap.set(node.path, node);
                            } else if (node.children) {
                              node.children.forEach(addNodeToMap);
                            }
                          };

                          prevFiles.forEach(addNodeToMap);
                          followUpFiles.forEach(addNodeToMap);

                          // Rebuild tree structure
                          return processFiles(
                            [...newFileMap.values()]
                              .map(
                                (node) =>
                                  `<boltAction type="file" filePath="${node.path}">${node.content}</boltAction>`
                              )
                              .join("\n")
                          );
                        });

                        // Clear the input
                        setprompt("");

                        // Remount files to WebContainer
                        if (webcontainer && newSteps.length > 0) {
                          // Set a loading state
                          setIsWebContainerLoading(true);
                          
                          // Clear the input right away
                          setprompt("");
                          
                          // Ensure all state updates are processed before remounting
                          setTimeout(async () => {
                            const success = await remountFilesToWebContainer();
                            if (!success) {
                              setError("Failed to update preview with latest changes");
                            }
                          }, 500);
                        }
                      }
                    } catch (error) {
                      console.error("Error processing follow-up:", error);
                      setError("Error processing follow-up request");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="absolute right-2 bottom-2 rounded-md p-1 text-white"
                >
                  <Send
                    className={`w-5 h-5 cursor-pointer ${
                      isProcessing ? "opacity-50" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Editor and Preview Panel */}

        <div className="flex-1 flex flex-col">
          {/* Explorer and Editor Container */}
          <div className="flex flex-1 overflow-hidden">
            {/* File Explorer */}
            <div className="w-64 border-r border-gray-800/50 bg-gray-950/60">
              <div className="p-3 border-b border-gray-800/50 bg-gray-950/40">
                <h3 className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Explorer
                </h3>
              </div>
              <div className="p-2 overflow-y-auto h-[calc(100vh-110px)]">
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2" />
                    <p className="text-gray-500 text-sm">Loading files...</p>
                  </div>
                ) : files.length > 0 ? (
                  renderFileTree(files)
                ) : (
                  <div className="text-center p-4 text-gray-500 text-sm">
                    No files yet
                  </div>
                )}
              </div>
            </div>

            {/* Editor/Preview */}
            <div className="flex-1 flex flex-col bg-gray-950/40">
              {/* Improved tab bar */}
              <div className="flex items-center border-b border-gray-800/50 px-2 bg-gray-950/60">
                <div className="flex">
                  <button
                    className={`px-4 py-3 flex items-center gap-2 transition-colors ${
                      activeTab === "code"
                        ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900/30"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/20"
                    }`}
                    onClick={() => setActiveTab("code")}
                  >
                    <Code className="w-4 h-4" />
                    Code Editor
                  </button>
                  <button
                    className={`px-4 py-3 flex items-center gap-2 transition-colors ${
                      activeTab === "preview"
                        ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900/30"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/20"
                    }`}
                    onClick={() => setActiveTab("preview")}
                  >
                    <Eye className="w-4 h-4" />
                    Live Preview
                  </button>
                </div>

                {selectedFile && (
                  <div className="ml-auto flex items-center bg-gray-900/50 rounded-md px-3 py-1.5 max-w-[40%]">
                    <FileIcon className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-300 truncate">
                      {selectedFile}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === "code" ? (
                  <div className="h-full relative transition-all duration-200 ease-in-out">
                    {isEditorLoading && (
                      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-10">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-gray-300">Loading editor...</p>
                        </div>
                      </div>
                    )}
                    <div className="h-full rounded-lg overflow-hidden">
                      <Editor
                        height="100%"
                        language={getFileLanguage(selectedFile || "")}
                        value={fileContent}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          wordWrap: "on",
                          padding: { top: 16, bottom: 16 },
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          renderLineHighlight: "all",
                          smoothScrolling: true,
                          cursorBlinking: "smooth",
                          contextmenu: true,
                          fontFamily:
                            "'Menlo', 'Monaco', 'Courier New', monospace",
                          fontLigatures: true,
                          folding: true,
                          links: true,
                          bracketPairColorization: {
                            enabled: true,
                            independentColorPoolPerBracketType: true,
                          },
                        }}
                        loading={null} // We handle loading state ourselves
                        onMount={() => setIsEditorLoading(false)}
                        className="editor-container" // Added for any custom styling
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full transition-all duration-200 ease-in-out">
                    <div className="bg-white h-full rounded-md m-0.5 overflow-hidden border border-gray-800/30">
                      {!webContainerUrl ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-800">
                          <div className="p-6 bg-gray-100 rounded-lg shadow-inner text-center max-w-md">
                            <Eye className="w-8 h-8 text-gray-400 mb-3 mx-auto" />
                            <p className="text-lg font-medium text-gray-600 mb-2">
                              Preview Not Available
                            </p>
                            <p className="text-gray-500 text-sm mb-4">
                              Your application preview will appear here once
                              WebContainer is ready
                            </p>
                            {areFilesLoaded && !isWebContainerMounted && (
                              <button
                                onClick={mountFilesToWebContainer}
                                disabled={
                                  isWebContainerLoading || !webcontainer
                                }
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md mx-auto"
                              >
                                {isWebContainerLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Mounting...
                                  </>
                                ) : (
                                  <>Mount Files</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="relative h-full">
                          <iframe
                            src={webContainerUrl}
                            title="Preview"
                            className="w-full h-full"
                            sandbox="allow-same-origin allow-scripts allow-forms"
                          ></iframe>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-xl">
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-xl font-semibold">
                  Processing your request...
                </p>
                <p className="text-gray-400 mt-2">
                  Building your project files
                </p>
              </div>
            </div>
          </div>
        )}

        {areFilesLoaded && !isWebContainerMounted && (
          <div className="absolute bottom-4 right-4 bg-gray-800 rounded-lg p-3 shadow-lg z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={mountFilesToWebContainer}
                disabled={isWebContainerLoading || !webcontainer}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                {isWebContainerLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mounting files...
                  </>
                ) : (
                  <>Mount Files to WebContainer</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Builder;
