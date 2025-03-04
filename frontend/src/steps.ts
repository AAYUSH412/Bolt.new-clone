enum StepType {
  Createfile = 'Createfile',
  Updatefile = 'Updatefile',
  Deletefile = 'Deletefile',
  Installpackage = 'Installpackage',
  Runcommand = 'Runcommand'
}

interface Step {
  title: string;
  description: string;
  type: StepType;
  status: 'pending' | 'processing' | 'completed';
  code?: string;
}

 interface Project {
  prompt: string;
  steps: Step[];
}

 interface FileItem {
  name: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  content?: string;
  path: string;
}

 interface FileViewerProps {
  file: FileItem | null;
  onClose: () => void;
}
/*
 * Parse input XML and convert it into steps.
 * Eg: Input - 
 * <boltArtifact id=\"project-import\" title=\"Project Files\">
 *  <boltAction type=\"file\" filePath=\"eslint.config.js\">
 *      import js from '@eslint/js';\nimport globals from 'globals';\n
 *  </boltAction>
 * <boltAction type="shell">
 *      node index.js
 * </boltAction>
 * </boltArtifact>
 * 
 * Output - 
 * [{
 *      title: "Project Files",
 *      status: "Pending"
 * }, {
 *      title: "Create eslint.config.js",
 *      type: StepType.CreateFile,
 *      code: "import js from '@eslint/js';\nimport globals from 'globals';\n"
 * }, {
 *      title: "Run command",
 *      code: "node index.js",
 *      type: StepType.RunScript
 * }]
 * 
 * The input can have strings in the middle they need to be ignored
 */
export function parseXml(response: string): Step[] {
  // Extract the XML content between <boltArtifact> tags
  const xmlMatch = response.match(/<boltArtifact[^>]*>([\s\S]*?)<\/boltArtifact>/);
  
  if (!xmlMatch) {
    return [];
  }

  const xmlContent = xmlMatch[1];
  const steps: Step[] = [];
  const processedFilePaths = new Set<string>(); // Track which files we've already processed

  // Extract artifact title
  const titleMatch = response.match(/title="([^"]*)"/);
  const artifactTitle = titleMatch ? titleMatch[1] : 'Project Files';

  // Add initial step
  steps.push({
    title: artifactTitle,
    description: 'Setting up project structure',
    type: StepType.Createfile,
    status: 'completed'
  });

  // Regular expression to find boltAction elements
  const actionRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;
  
  let match;
  while ((match = actionRegex.exec(xmlContent)) !== null) {
    const [, type, filePath, content] = match;

    if (type === 'file' && !processedFilePaths.has(filePath)) {
      processedFilePaths.add(filePath);
      steps.push({
        title: `Create ${filePath}`,
        description: `Creating file: ${filePath}`,
        type: StepType.Createfile,
        status: 'pending',
        code: content.trim()
      });
    } else if (type === 'shell') {
      const command = content.trim();
      if (command.includes('npm install') || command.includes('npm i')) {
        steps.push({
          title: 'Install Dependencies',
          description: command,
          type: StepType.Installpackage,
          status: 'pending',
          code: command
        });
      } else {
        steps.push({
          title: 'Run Command',
          description: command,
          type: StepType.Runcommand,
          status: 'pending',
          code: command
        });
      }
    }
  }

  return steps;
}