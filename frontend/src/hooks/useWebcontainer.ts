import { useEffect, useState } from "react";
import { WebContainer } from '@webcontainer/api';

// Create a singleton instance to ensure we only boot once
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export function useWebcontainer() {
  const [webcontainer, setWebcontainer] = useState<WebContainer | undefined>(undefined);
  const [webContainerUrl, setWebContainerUrl] = useState<string | null>(null);
  
  async function main() {
    try {
      // If we already have an instance, use it
      if (webcontainerInstance) {
        setWebcontainer(webcontainerInstance);
        return;
      }
      
      // If boot is in progress, wait for it
      if (bootPromise) {
        const instance = await bootPromise;
        setWebcontainer(instance);
        return;
      }
      
      // Start boot process and store the promise
      bootPromise = WebContainer.boot();
      
      // Wait for boot to complete
      webcontainerInstance = await bootPromise;
      setWebcontainer(webcontainerInstance);
      
      // Set up a listener for the dev server URL
      webcontainerInstance.on('server-ready', (port, url) => {
        console.log(`WebContainer server ready at port ${port} with URL: ${url}`);
        setWebContainerUrl(url);
      });
    } catch (error) {
      console.error("Failed to boot WebContainer:", error);
      // Reset promise so we can try again
      bootPromise = null;
    }
  }
  
  useEffect(() => {
    main();
  }, []);
  
  return { 
    webcontainer, 
    webContainerUrl,
    setWebContainerUrl // Export the URL setter function
  };
}