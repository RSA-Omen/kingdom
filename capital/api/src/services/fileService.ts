import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import Docker from 'dockerode';

const execAsync = promisify(exec);

export class FileService {
  // Base directory for operations (project root)
  private baseDir: string;

  constructor() {
    // Check if we're in a container with /workspace mounted (for docker-compose commands)
    // The workspace is mounted as /workspace in the container
    // From admin-center, the compose files are at /workspace/admin-center
    if (process.env.WORKSPACE || existsSync('/workspace')) {
      this.baseDir = process.env.PROJECT_ROOT || process.env.WORKSPACE || '/workspace';
    } else {
      this.baseDir = process.env.PROJECT_ROOT || '/home/lauchlandupreez';
    }
  }

  /**
   * Safely read a file
   */
  async readFile(filePath: string): Promise<{ content: string; exists: boolean }> {
    try {
      // Resolve path relative to baseDir and ensure it's within baseDir (security)
      const resolvedPath = resolve(this.baseDir, filePath);
      const baseResolved = resolve(this.baseDir);
      
      if (!resolvedPath.startsWith(baseResolved)) {
        throw new Error('Path traversal detected. Access denied.');
      }

      if (!existsSync(resolvedPath)) {
        return { content: '', exists: false };
      }

      const content = await readFile(resolvedPath, 'utf-8');
      return { content, exists: true };
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Safely write a file (with backup)
   */
  async writeFile(filePath: string, content: string, createBackup: boolean = true): Promise<{ success: boolean; backupPath?: string }> {
    try {
      const resolvedPath = resolve(this.baseDir, filePath);
      const baseResolved = resolve(this.baseDir);
      
      if (!resolvedPath.startsWith(baseResolved)) {
        throw new Error('Path traversal detected. Access denied.');
      }

      let backupPath: string | undefined;
      
      // Create backup if file exists
      if (createBackup && existsSync(resolvedPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${resolvedPath}.backup.${timestamp}`;
        const existingContent = await readFile(resolvedPath, 'utf-8');
        await writeFile(backupPath, existingContent, 'utf-8');
      }

      // Ensure directory exists
      const dir = dirname(resolvedPath);
      if (!existsSync(dir)) {
        const { exec } = require('child_process');
        await promisify(exec)(`mkdir -p "${dir}"`);
      }

      // Write file
      await writeFile(resolvedPath, content, 'utf-8');
      
      return { success: true, backupPath };
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Safely execute a command
   * For docker-compose commands, executes them on the host system
   */
  async executeCommand(
    command: string,
    workingDir?: string,
    timeout: number = 30000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      // Check if this is a docker-compose command that needs special handling
      const isDockerCompose = /docker-compose|docker\s+compose/.test(command);
      
      if (isDockerCompose) {
        // For docker-compose commands, use dockerode to run via docker/compose image
        // Extract compose file path and command
        const composeMatch = command.match(/(?:docker-compose|docker\s+compose)(?:\s+-f\s+([^\s]+))?\s+(.+)/);
        if (composeMatch) {
          const composeFile = composeMatch[1] || null; // Will auto-detect if not specified
          const composeCommand = composeMatch[2];
          // Use workingDir if provided, otherwise use baseDir
          const composeDir = workingDir ? resolve(this.baseDir, workingDir) : this.baseDir;
          
          // Use dockerode to execute via docker/compose image (docker CLI not available in container)
          return await this.executeDockerComposeViaAPI(composeCommand, composeDir, composeFile);
        }
      }
      
      const cwd = workingDir ? resolve(this.baseDir, workingDir) : this.baseDir;
      
      // Security: Only allow safe commands (no rm -rf, etc. without confirmation)
      const dangerousPatterns = [
        /rm\s+-rf/,
        /rm\s+-r/,
        /format/,
        /dd\s+if=/,
        /mkfs/,
        /shutdown/,
        /reboot/,
        /poweroff/,
      ];

      // Check for dangerous commands (we'll allow them but log a warning)
      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      if (isDangerous) {
        console.warn(`⚠️  Potentially dangerous command detected: ${command}`);
      }

      // For BusyBox/Alpine containers, /bin/sh is a symlink to /bin/busybox
      // Use shell: true to let Node.js handle shell resolution properly
      const execOptions: any = {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: true // Use shell: true instead of shell path to avoid symlink issues
      };

      const { stdout, stderr } = await execAsync(command, execOptions);

      return {
        stdout: typeof stdout === 'string' ? stdout : stdout.toString(),
        stderr: typeof stderr === 'string' ? stderr : stderr.toString(),
        exitCode: 0
      };
    } catch (error: any) {
      // Provide better error message for shell-related errors
      if (error.code === 'ENOENT' && error.message.includes('spawn')) {
        return {
          stdout: '',
          stderr: `Command execution failed: Shell or command not available. Error: ${error.message}. Command: ${command}. Note: docker-compose commands need to run on the host system.`,
          exitCode: 127 // Command not found exit code
        };
      }

      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Execute docker-compose commands via Docker API using docker/compose image
   */
  private async executeDockerComposeViaAPI(command: string, composeDir: string, composeFile?: string | null): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
      const docker = new Docker({ socketPath });
      
      // Parse docker-compose commands
      const scaleMatch = command.match(/scale\s+(\S+)=(\d+)(?:\s+(.+))?/);
      let composePath = composeDir || this.baseDir;
      
      // Determine compose file if not specified
      let finalComposeFile = composeFile;
      if (!finalComposeFile) {
        // First check in the specified directory
        let composeFilePath = join(composePath, 'docker-compose.yml');
        let devComposePath = join(composePath, 'docker-compose.dev.yml');
        let foundComposeFile = existsSync(devComposePath) ? 'docker-compose.dev.yml' : '';
        if (!foundComposeFile && existsSync(composeFilePath)) {
          foundComposeFile = 'docker-compose.yml';
        }
        
        // If not found, check common subdirectories (admin-center, etc.)
        if (!foundComposeFile) {
          // The workspace is mounted as /workspace which maps to /home on the host
          // So compose files might be at /workspace/lauchlandupreez/admin-center
          const searchPaths: string[] = [this.baseDir];
          
          // If in container with /workspace mount, check workspace subdirectories
          if (existsSync('/workspace')) {
            // Check common user directory names in /workspace
            const workspaceDirs = ['lauchlandupreez', 'admin', 'user'];
            for (const wsDir of workspaceDirs) {
              const wsPath = join('/workspace', wsDir);
              if (existsSync(wsPath)) {
                searchPaths.push(wsPath);
              }
            }
            searchPaths.push('/workspace'); // Also check /workspace directly
          }
          
          const commonDirs = ['admin-center', 'app', 'services', 'docker'];
          
          for (const basePath of searchPaths) {
            for (const dir of commonDirs) {
              const testPath = join(basePath, dir);
              composeFilePath = join(testPath, 'docker-compose.yml');
              devComposePath = join(testPath, 'docker-compose.dev.yml');
              if (existsSync(devComposePath)) {
                composePath = testPath;
                foundComposeFile = 'docker-compose.dev.yml';
                break;
              } else if (existsSync(composeFilePath)) {
                composePath = testPath;
                foundComposeFile = 'docker-compose.yml';
                break;
              }
            }
            if (foundComposeFile) break;
          }
        }
        
        finalComposeFile = foundComposeFile;
      } else {
        // If composeFile is specified, verify it exists
        const testPath = join(composePath, finalComposeFile);
        if (!existsSync(testPath)) {
          // Try in common subdirectories
          const commonDirs = ['admin-center', 'app', 'services', 'docker'];
          for (const dir of commonDirs) {
            const testDir = join(this.baseDir, dir);
            const testFilePath = join(testDir, finalComposeFile);
            if (existsSync(testFilePath)) {
              composePath = testDir;
              break;
            }
          }
        }
      }
      
      if (!finalComposeFile || !existsSync(join(composePath, finalComposeFile))) {
        return {
          stdout: '',
          stderr: `No docker-compose.yml or docker-compose.dev.yml found in ${composePath} or common subdirectories (admin-center, app, services, docker). Searched: ${composePath}, ${join(this.baseDir, 'admin-center')}, ${join(this.baseDir, 'app')}, ${join(this.baseDir, 'services')}, ${join(this.baseDir, 'docker')}`,
          exitCode: 1
        };
      }
      
      // Command is already parsed (e.g., "scale pdf-removal-api=2")
      const composeCommand = command.trim();
      
      // Use dockerode to run docker/compose image as a container
      // This will execute docker-compose commands via the Docker socket
      const cmdParts = composeCommand.split(/\s+/).filter(p => p.length > 0);
      
      // When mounting from inside a container to another container, we need to use the host path
      // composePath is a path inside admin-center-backend container (e.g., /workspace/lauchlandupreez/admin-center)
      // But Docker bind mounts require host paths. We need to resolve the actual host path.
      // Since /workspace is mounted from ../.. (which from admin-center is /home/lauchlandupreez),
      // /workspace/lauchlandupreez/admin-center maps to /home/lauchlandupreez/lauchlandupreez/admin-center... no wait.
      // Actually, /workspace = /home/lauchlandupreez, so /workspace/lauchlandupreez = /home/lauchlandupreez/lauchlandupreez
      // But the actual host path for admin-center is /home/lauchlandupreez/admin-center
      // So we should calculate: if composePath is /workspace/X/Y, host path is /home/X/Y
      // For now, let's try using the /workspace mount that already exists and mount the entire /workspace
      // Or better: calculate host path from composePath
      
      // Calculate host path: if composePath starts with /workspace/, resolve to host path
      // The workspace is mounted as ../..:/workspace which from admin-center is /home/lauchlandupreez:/workspace
      // But the actual structure shows /workspace/lauchlandupreez/admin-center exists in container
      // The actual host path for admin-center is /home/lauchlandupreez/admin-center
      // So we need to resolve: /workspace/lauchlandupreez/admin-center -> /home/lauchlandupreez/admin-center
      // Note: We can't use existsSync to verify host paths from inside container - Docker bind mounts
      // resolve on the host, so we'll use the calculated path and let Docker handle it
      let hostPath = composePath;
      if (composePath.startsWith('/workspace/')) {
        const relativePath = composePath.substring('/workspace/'.length);
        const parts = relativePath.split('/');
        // If first part is the username (lauchlandupreez), remove it since /workspace = /home/lauchlandupreez
        // /workspace/lauchlandupreez/admin-center -> /home/lauchlandupreez/admin-center
        if (parts.length > 1 && parts[0] === 'lauchlandupreez') {
          hostPath = join('/home/lauchlandupreez', parts.slice(1).join('/'));
        } else {
          // Fallback: /workspace/X -> /home/X
          hostPath = join('/home', relativePath);
        }
      } else if (!composePath.startsWith('/')) {
        // Relative path - resolve relative to baseDir
        hostPath = resolve(this.baseDir, composePath);
      }
      
      // For admin-center specifically, use known host path
      // This is the most common case and ensures correct path resolution
      if (composePath.includes('admin-center')) {
        hostPath = '/home/lauchlandupreez/admin-center';
      }
      
      const containerConfig: Docker.ContainerCreateOptions = {
        Image: 'docker/compose:latest',
        // Use absolute path for -f flag
        Cmd: ['-f', `/workspace/${finalComposeFile}`, ...cmdParts],
        WorkingDir: '/workspace',
        HostConfig: {
          Binds: [
            `${socketPath}:/var/run/docker.sock`,
            `${hostPath}:/workspace:ro` // Mount host path to /workspace
          ],
          AutoRemove: true // --rm flag
        },
        AttachStdout: true,
        AttachStderr: true
      };
      
      try {
        const container = await docker.createContainer(containerConfig);
        await container.start();
        
        // Wait for container to finish and get exit code
        const waitData = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            container.stop().catch(() => {});
            reject(new Error('Command timed out after 60 seconds'));
          }, 60000);
          
          container.wait((err: any, data: any) => {
            clearTimeout(timeout);
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        // Get logs after container finishes
        // dockerode logs callback returns (err, buffer) where buffer is a Buffer
        const logBuffer = await new Promise<Buffer>((resolve, reject) => {
          container.logs({ stdout: true, stderr: true, follow: false }, (err: any, buffer?: Buffer) => {
            if (err) return reject(err);
            resolve(buffer || Buffer.from(''));
          });
        });
        
        // Parse Docker log format (8-byte header per log line)
        // Header format: [streamType(1 byte)][timestamp(3 bytes)][length(4 bytes)] + data
        let stdout = '';
        let stderr = '';
        
        let offset = 0;
        while (offset < logBuffer.length) {
          if (offset + 8 > logBuffer.length) break;
          
          const streamType = logBuffer[offset];
          // Read 32-bit BE length from bytes 4-7 (bytes 0-3 are stream type + reserved/timestamp)
          const lineLength = logBuffer.readUInt32BE(offset + 4);
          const headerSize = 8;
          
          if (offset + headerSize + lineLength > logBuffer.length) {
            // Incomplete log entry, break
            break;
          }
          
          const lineContent = logBuffer.slice(offset + headerSize, offset + headerSize + lineLength).toString('utf8');
          
          // Stream type: 0x01 = stdout, 0x02 = stderr
          if (streamType === 0x01 || streamType === 1) {
            stdout += lineContent;
          } else if (streamType === 0x02 || streamType === 2) {
            stderr += lineContent;
          }
          
          offset += headerSize + lineLength;
        }
        
        return {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: waitData?.StatusCode || 0
        };
      } catch (createError: any) {
        // If docker/compose image doesn't exist, pull it first or provide helpful error
        if (createError.statusCode === 404) {
          // Try to pull the image
          try {
            await new Promise<void>((resolve, reject) => {
              docker.pull('docker/compose:latest', (err: any, stream: any) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, (err: any, output: any) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });
            // Retry after pulling
            return this.executeDockerComposeViaAPI(command, composeDir, finalComposeFile);
          } catch (pullError: any) {
            return {
              stdout: '',
              stderr: `docker/compose image not found and could not be pulled: ${pullError.message}. Please run: docker pull docker/compose:latest on the host system, or execute the command manually: cd ${composePath} && docker compose -f ${finalComposeFile} ${composeCommand}`,
              exitCode: 1
            };
          }
        }
        
        return {
          stdout: '',
          stderr: `Failed to execute docker-compose command: ${createError.message}. Please ensure docker/compose:latest image is available or run manually: cd ${composePath} && docker compose -f ${finalComposeFile} ${composeCommand}`,
          exitCode: 1
        };
      }
    } catch (error: any) {
      return {
        stdout: '',
        stderr: `Error executing docker-compose command: ${error.message}`,
        exitCode: 1
      };
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = resolve(this.baseDir, filePath);
      const baseResolved = resolve(this.baseDir);
      
      if (!resolvedPath.startsWith(baseResolved)) {
        return false;
      }

      return existsSync(resolvedPath);
    } catch {
      return false;
    }
  }

  /**
   * Get file stats (size, modified date, etc.)
   */
  async getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number; modified?: Date } | null> {
    try {
      const resolvedPath = resolve(this.baseDir, filePath);
      const baseResolved = resolve(this.baseDir);
      
      if (!resolvedPath.startsWith(baseResolved)) {
        return null;
      }

      if (!existsSync(resolvedPath)) {
        return { exists: false };
      }

      const { stat } = require('fs/promises');
      const stats = await stat(resolvedPath);
      
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime
      };
    } catch {
      return null;
    }
  }
}

export const fileService = new FileService();

