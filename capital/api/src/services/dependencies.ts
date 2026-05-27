import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

// Optional in-memory cache for dependency scans (default: off — scans always reflect disk).
// Set DEPENDENCY_SCAN_CACHE_MS e.g. to 300000 to cache results for 5 minutes (faster, can be stale).
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = (() => {
  const raw = process.env.DEPENDENCY_SCAN_CACHE_MS;
  if (raw === undefined || raw === '') return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
let summaryCache: CacheEntry<any> | null = null;

// Progress tracking
export interface ScanProgress {
  isScanning: boolean;
  currentStep: string;
  progress: number; // 0-100
  totalSteps: number;
  completedSteps: number;
  currentProject?: string;
  errors?: string[];
}

let scanProgress: ScanProgress = {
  isScanning: false,
  currentStep: 'Idle',
  progress: 0,
  totalSteps: 0,
  completedSteps: 0,
  errors: [],
};

export interface DependencyInfo {
  name: string;
  version: string;
  latest?: string;
  vulnerable?: boolean;
  severity?: string;
}

export interface Vulnerability {
  package: string;
  severity: string;
  title: string;
  description?: string;
  recommendation?: string;
}

/**
 * npm audit v2 uses a `via` array of advisory objects; older parsers missed titles/severity.
 */
function flattenNpmAuditVulnerabilityEntries(auditData: {
  vulnerabilities?: Record<string, unknown>;
}): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const raw = auditData.vulnerabilities;
  if (!raw || typeof raw !== 'object') return vulnerabilities;

  for (const [packageName, rawEntry] of Object.entries(raw)) {
    const vulnData = rawEntry as Record<string, unknown>;
    if (Array.isArray(vulnData)) {
      vulnData.forEach((vuln: Record<string, unknown>) => {
        vulnerabilities.push({
          package: packageName,
          severity: (vuln.severity as string) || 'unknown',
          title: (vuln.title as string) || (vuln.name as string) || 'Unknown vulnerability',
          description: vuln.overview as string | undefined,
          recommendation: vuln.recommendation as string | undefined,
        });
      });
      continue;
    }

    const via = vulnData.via;
    if (Array.isArray(via) && via.length > 0) {
      let added = false;
      for (const v of via) {
        if (v && typeof v === 'object' && 'title' in (v as object)) {
          const adv = v as Record<string, unknown>;
          vulnerabilities.push({
            package: packageName,
            severity: (adv.severity as string) || (vulnData.severity as string) || 'unknown',
            title: (adv.title as string) || (adv.name as string) || 'Unknown vulnerability',
            description: adv.overview as string | undefined,
            recommendation: adv.recommendation as string | undefined,
          });
          added = true;
        }
      }
      if (added) continue;
    }

    vulnerabilities.push({
      package: packageName,
      severity: (vulnData.severity as string) || 'unknown',
      title: (vulnData.title as string) || (vulnData.name as string) || 'Unknown vulnerability',
      description: vulnData.overview as string | undefined,
      recommendation: vulnData.recommendation as string | undefined,
    });
  }
  return vulnerabilities;
}

export interface ReactProject {
  path: string;
  name: string;
  framework?: string;
  reactVersion?: string;
  reactDomVersion?: string;
  nextVersion?: string;
  dependencies: DependencyInfo[];
  vulnerabilities: Vulnerability[];
  lastScanned?: string;
  packageJsonPath: string;
  componentType?: 'frontend' | 'backend' | 'database' | 'other';
  appName?: string; // The parent application name
}

export interface PythonProject {
  path: string;
  name: string;
  framework?: string; // Flask, Django, FastAPI, etc.
  pythonVersion?: string;
  dependencies: DependencyInfo[];
  vulnerabilities: Vulnerability[];
  lastScanned?: string;
  requirementsPath?: string;
  componentType?: 'frontend' | 'backend' | 'database' | 'other';
  appName?: string; // The parent application name
}

export interface ApplicationInfo {
  appName: string;
  path: string;
  hasFrontend: boolean;
  hasBackend: boolean;
  hasDatabase: boolean;
  frontendPath?: string;
  backendPath?: string;
  databasePath?: string;
  type?: 'react' | 'python' | 'node' | 'mixed' | 'unknown';
}

export interface ApplicationGroup {
  appName: string;
  path: string; // Base path of the application
  components: {
    frontend?: ReactProject | PythonProject;
    backend?: ReactProject | PythonProject;
    database?: ReactProject | PythonProject;
    other?: (ReactProject | PythonProject)[];
  };
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  appInfo?: ApplicationInfo; // Additional app metadata
}

class DependenciesService {
  private workspaceRoot: string;

  constructor() {
    // Default to the parent directory of admin-center (where other projects are)
    // In Docker, we need to use paths relative to /app or use mounted volumes
    if (process.env.WORKSPACE_ROOT) {
      this.workspaceRoot = process.env.WORKSPACE_ROOT;
    } else {
      // Try to detect if we're in a container or on host
      // If /app exists (Docker), use relative paths from there
      if (existsSync('/app')) {
        // In Docker container - backend is at /app, frontend should be at /app/../frontend
        // For other projects, they might be mounted or we need to use different paths
        this.workspaceRoot = '/app/..';
      } else {
        // On host system
        this.workspaceRoot = '/home/lauchlandupreez';
      }
    }
  }

  /**
   * Helper to clean version string (removes ^, ~, >=, <, etc.)
   */
  private cleanVersion(version: string): string {
    return version.replace(/[\^~>=<]/g, '').trim();
  }

  /**
   * Normalize app name consistently across the codebase
   */
  private normalizeAppName(appName: string): string {
    // Remove ticket numbers like D-2510-006
    let normalized = appName.replace(/^D-\d+-/, '').replace(/\s+/g, ' ').trim();
    
    // Apply specific normalizations
    if (normalized === 'TLDR' || normalized.includes('TLDR')) {
      normalized = 'TLDR';
    } else if (normalized.includes('Gekko')) {
      normalized = 'Gekko-Tracks';
    } else if (normalized === '002 AP Processing Implied Links') {
      normalized = 'AP Processing Implied Links';
    } else if (normalized === '004-credit-card-coding') {
      normalized = 'Credit Card Coding';
    } else if (normalized === 'interceptor-app') {
      normalized = 'Interceptor App';
    } else if (normalized === 'pronto-api-deployment') {
      normalized = 'Pronto API Deployment';
    }
    
    return normalized;
  }

  /**
   * Detect component type and app name from project path
   */
  private detectComponentType(path: string): { componentType: 'frontend' | 'backend' | 'database' | 'other', appName: string } {
    const pathParts = path.split('/').filter(p => p);
    const lowerPath = path.toLowerCase();
    
    // Determine component type
    let componentType: 'frontend' | 'backend' | 'database' | 'other' = 'other';
    if (lowerPath.includes('/frontend') || lowerPath.includes('/web') || lowerPath.includes('/client') || lowerPath.includes('/app')) {
      componentType = 'frontend';
    } else if (lowerPath.includes('/backend') || lowerPath.includes('/api') || lowerPath.includes('/server')) {
      componentType = 'backend';
    } else if (lowerPath.includes('/database') || lowerPath.includes('/db')) {
      componentType = 'database';
    } else {
      // If it's a React project but path doesn't indicate type, assume frontend
      componentType = 'frontend';
    }
    
    // Extract app name from path
    // Look for common patterns: Operations/AppName, Management/AppName, etc.
    let appName = 'Unknown App';
    
    // Try to find the app name by looking for Operations or Management in path
    const opsIndex = pathParts.findIndex(p => p === 'Operations');
    const mgmtIndex = pathParts.findIndex(p => p === 'Management');
    const adminIndex = pathParts.findIndex(p => p === 'admin-center');
    
    if (opsIndex !== -1 && opsIndex + 1 < pathParts.length) {
      // Get the next part after Operations
      appName = pathParts[opsIndex + 1];
    } else if (mgmtIndex !== -1 && mgmtIndex + 1 < pathParts.length) {
      appName = pathParts[mgmtIndex + 1];
    } else if (adminIndex !== -1) {
      appName = 'Admin Center';
    } else {
      // Fallback: use the directory name before frontend/backend/etc
      const componentIndex = pathParts.findIndex(p => 
        ['frontend', 'backend', 'web', 'client', 'api', 'server'].includes(p.toLowerCase())
      );
      if (componentIndex > 0) {
        appName = pathParts[componentIndex - 1];
      } else if (pathParts.length > 0) {
        appName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
      }
    }
    
    // Normalize app name using the shared function
    appName = this.normalizeAppName(appName);
    
    return { componentType, appName };
  }

  /**
   * Discover all applications in Operations and Management folders
   */
  private discoverAllApplications(): ApplicationInfo[] {
    const applications: ApplicationInfo[] = [];
    const isDocker = existsSync('/app');
    const operationsPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Operations'
      : '/home/lauchlandupreez/Operations';
    const managementPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Management'
      : '/home/lauchlandupreez/Management';

    // Scan Operations folder
    if (existsSync(operationsPath)) {
      try {
        const entries = readdirSync(operationsPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const appPath = join(operationsPath, entry.name);
            const appInfo = this.analyzeApplication(appPath, entry.name);
            if (appInfo) {
              applications.push(appInfo);
            }
          }
        }
      } catch (error) {
        console.error('Error scanning Operations folder:', error);
      }
    }

    // Scan Management folder
    if (existsSync(managementPath)) {
      try {
        const entries = readdirSync(managementPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const appPath = join(managementPath, entry.name);
            const appInfo = this.analyzeApplication(appPath, entry.name);
            if (appInfo) {
              applications.push(appInfo);
            }
          }
        }
      } catch (error) {
        console.error('Error scanning Management folder:', error);
      }
    }

    return applications;
  }

  /**
   * Analyze an application directory to detect components
   */
  private analyzeApplication(appPath: string, dirName: string): ApplicationInfo | null {
    // Skip certain directories
    if (['node_modules', 'venv', '.venv', '.git', 'dist', 'build', 'logs', 'data', '.tmp', 'working'].includes(dirName) ||
        dirName.toLowerCase().includes('working')) {
      return null;
    }

    // Normalize app name using the shared function
    let appName = this.normalizeAppName(dirName);

    let hasFrontend = false;
    let hasBackend = false;
    let hasDatabase = false;
    let frontendPath: string | undefined;
    let backendPath: string | undefined;
    let databasePath: string | undefined;
    let type: 'react' | 'python' | 'node' | 'mixed' | 'unknown' = 'unknown';

    // Helper to check if a path is a Python backend
    const isPythonBackend = (path: string): boolean => {
      return existsSync(join(path, 'requirements.txt')) ||
             existsSync(join(path, 'main.py')) ||
             existsSync(join(path, 'app.py')) ||
             existsSync(join(path, 'run.py')) ||
             existsSync(join(path, 'server.py')) ||
             existsSync(join(path, 'wsgi.py')) ||
             existsSync(join(path, 'asgi.py'));
    };

    // Helper to check if a path is a React frontend
    const isReactFrontend = (path: string): boolean => {
      const packageJsonPath = join(path, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          return !!(pkg.dependencies?.react || pkg.devDependencies?.react);
        } catch (e) {
          return false;
        }
      }
      return false;
    };

    try {
      // Check root level first
      if (isPythonBackend(appPath)) {
        hasBackend = true;
        backendPath = appPath;
        type = 'python';
      } else if (isReactFrontend(appPath)) {
        hasFrontend = true;
        frontendPath = appPath;
        type = 'react';
      }

      const entries = readdirSync(appPath, { withFileTypes: true });
      
      // Check for common frontend/backend patterns in subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = join(appPath, entry.name);
          const lowerName = entry.name.toLowerCase();
          
          // Skip certain subdirectories
          if (['node_modules', 'venv', '.venv', '.git', 'dist', 'build', 'logs', 'data', '__pycache__', '.cache'].includes(entry.name) ||
              entry.name.startsWith('.')) {
            continue;
          }
          
          // Frontend detection - check common frontend folder names
          if (!hasFrontend && (['frontend', 'web', 'client', 'app', 'ui', 'web-app'].includes(lowerName) || 
              (lowerName.includes('front') && !lowerName.includes('back')))) {
            if (isReactFrontend(subPath)) {
              hasFrontend = true;
              frontendPath = subPath;
              if (type === 'unknown') type = 'react';
              else if (type === 'python') type = 'mixed';
            }
          }
          
          // Backend detection - check common backend folder names
          if (!hasBackend && (['backend', 'api', 'server', 'service', 'web-app'].includes(lowerName) ||
              (lowerName.includes('back') && !lowerName.includes('front')))) {
            if (isPythonBackend(subPath)) {
              hasBackend = true;
              backendPath = subPath;
              if (type === 'unknown') type = 'python';
              else if (type === 'react') type = 'mixed';
            } else {
              // Check for Node.js backend
              const packageJsonPath = join(subPath, 'package.json');
              if (existsSync(packageJsonPath)) {
                try {
                  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
                  if (!pkg.dependencies?.react && !pkg.devDependencies?.react) {
                    hasBackend = true;
                    backendPath = subPath;
                    if (type === 'unknown') type = 'node';
                    else if (type === 'react') type = 'mixed';
                  }
                } catch (e) {
                  // Invalid package.json
                }
              }
            }
          }
          
          // Database detection
          if (!hasDatabase && ['database', 'db', 'data'].includes(lowerName)) {
            hasDatabase = true;
            databasePath = subPath;
          }
        }
      }

      // Also check for Python files in root (for apps without clear structure)
      if (!hasBackend && !hasFrontend) {
        try {
          const files = readdirSync(appPath);
          const hasPythonFiles = files.some(f => f.endsWith('.py') && !f.startsWith('.'));
          if (hasPythonFiles && (existsSync(join(appPath, 'requirements.txt')) || 
              files.some(f => ['main.py', 'app.py', 'run.py', 'server.py'].includes(f)))) {
            hasBackend = true;
            backendPath = appPath;
            type = 'python';
          }
        } catch (e) {
          // Can't read directory
        }
      }
    } catch (error) {
      // Directory might not be accessible
      return null;
    }

    return {
      appName,
      path: appPath,
      hasFrontend,
      hasBackend,
      hasDatabase,
      frontendPath,
      backendPath,
      databasePath,
      type,
    };
  }

  /**
   * Group projects by application and include all discovered apps
   */
  groupProjectsByApplication(reactProjects: ReactProject[], pythonProjects: PythonProject[]): ApplicationGroup[] {
    const groups = new Map<string, ApplicationGroup>();
    
    // First, discover all applications
    const allApps = this.discoverAllApplications();
    
    // Initialize groups for all discovered apps
    for (const app of allApps) {
      if (!groups.has(app.appName)) {
        groups.set(app.appName, {
          appName: app.appName,
          path: app.path,
          components: {},
          totalVulnerabilities: 0,
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          mediumVulnerabilities: 0,
          lowVulnerabilities: 0,
          appInfo: app,
        });
      }
    }
    
    // Add React projects to their respective groups
    for (const project of reactProjects) {
      const appName = project.appName || 'Unknown App';
      const basePath = project.path.split('/').slice(0, -1).join('/');
      
      if (!groups.has(appName)) {
        groups.set(appName, {
          appName,
          path: basePath,
          components: {},
          totalVulnerabilities: 0,
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          mediumVulnerabilities: 0,
          lowVulnerabilities: 0,
        });
      }
      
      const group = groups.get(appName)!;
      const componentType = project.componentType || 'other';
      
      // Add component to appropriate slot
      if (componentType === 'frontend' && !group.components.frontend) {
        group.components.frontend = project;
      } else if (componentType === 'backend' && !group.components.backend) {
        group.components.backend = project;
      } else if (componentType === 'database' && !group.components.database) {
        group.components.database = project;
      } else {
        if (!group.components.other) {
          group.components.other = [];
        }
        group.components.other.push(project);
      }
      
      // Aggregate vulnerabilities
      project.vulnerabilities.forEach(vuln => {
        group.totalVulnerabilities++;
        const severity = vuln.severity.toLowerCase();
        if (severity === 'critical') group.criticalVulnerabilities++;
        else if (severity === 'high') group.highVulnerabilities++;
        else if (severity === 'medium') group.mediumVulnerabilities++;
        else if (severity === 'low') group.lowVulnerabilities++;
      });
    }

    // Add Python projects to their respective groups
    for (const project of pythonProjects) {
      const appName = project.appName || 'Unknown App';
      const basePath = project.path.split('/').slice(0, -1).join('/');
      
      if (!groups.has(appName)) {
        groups.set(appName, {
          appName,
          path: basePath,
          components: {},
          totalVulnerabilities: 0,
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          mediumVulnerabilities: 0,
          lowVulnerabilities: 0,
        });
      }
      
      const group = groups.get(appName)!;
      const componentType = project.componentType || 'other';
      
      // Add component to appropriate slot (Python projects typically go to backend)
      if (componentType === 'frontend' && !group.components.frontend) {
        group.components.frontend = project;
      } else if (componentType === 'backend' && !group.components.backend) {
        group.components.backend = project;
      } else if (componentType === 'database' && !group.components.database) {
        group.components.database = project;
      } else {
        // Default Python projects to backend if no component type specified
        if (!group.components.backend && componentType === 'other') {
          group.components.backend = project;
        } else {
          if (!group.components.other) {
            group.components.other = [];
          }
          group.components.other.push(project);
        }
      }
      
      // Aggregate vulnerabilities
      project.vulnerabilities.forEach(vuln => {
        group.totalVulnerabilities++;
        const severity = vuln.severity.toLowerCase();
        if (severity === 'critical') group.criticalVulnerabilities++;
        else if (severity === 'high') group.highVulnerabilities++;
        else if (severity === 'medium') group.mediumVulnerabilities++;
        else if (severity === 'low') group.lowVulnerabilities++;
      });
    }
    
    return Array.from(groups.values()).sort((a, b) => a.appName.localeCompare(b.appName));
  }

  /**
   * Scan for all React projects in the workspace
   */
  async scanAllProjects(): Promise<ReactProject[]> {
    const projects: ReactProject[] = [];
    
    // Adjust paths based on whether we're in Docker or on host
    const isDocker = existsSync('/app');
    const workspaceRoot = isDocker && existsSync('/workspace/lauchlandupreez') 
      ? '/workspace/lauchlandupreez' 
      : this.workspaceRoot;
    
    // Known specific project paths
    // Note: TLDR has been removed (replaced with open-webUI)
    const knownPaths = isDocker && existsSync('/workspace/lauchlandupreez') ? [
      // In Docker with workspace mounted at /workspace/lauchlandupreez
      '/workspace/lauchlandupreez/admin-center/frontend',
      '/workspace/lauchlandupreez/Operations/Gekko-Tracks/frontend',
      '/workspace/lauchlandupreez/Operations/Gekko-Tracks/backend',
    ] : isDocker ? [
      // In Docker without workspace mount - try relative paths
      '/app/../frontend',
    ] : [
      // On host system
      '/home/lauchlandupreez/admin-center/frontend',
      '/home/lauchlandupreez/Operations/Gekko-Tracks/frontend',
      '/home/lauchlandupreez/Operations/Gekko-Tracks/backend',
    ];

    // Scan Operations and Management folders specifically (user requested)
    // In Docker, workspace is mounted at /workspace/lauchlandupreez
    const operationsPath = isDocker && existsSync('/workspace/lauchlandupreez') 
      ? '/workspace/lauchlandupreez/Operations' 
      : '/home/lauchlandupreez/Operations';
    const managementPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Management'
      : '/home/lauchlandupreez/Management';
    
    // Also scan for any other React projects in the workspace
    const additionalPaths: string[] = [];
    
    // Scan Operations folder (increased depth to find nested projects)
    if (existsSync(operationsPath)) {
      additionalPaths.push(...this.findReactProjects(operationsPath, 6));
    }
    
    // Scan Management folder
    if (existsSync(managementPath)) {
      additionalPaths.push(...this.findReactProjects(managementPath, 6));
    }
    
    // Scan the entire workspace root as well
    if (existsSync(workspaceRoot)) {
      additionalPaths.push(...this.findReactProjects(workspaceRoot, 5));
    }

    const allPaths = [...knownPaths, ...additionalPaths];
    const uniquePaths = Array.from(new Set(allPaths));

    for (const projectPath of uniquePaths) {
      try {
        if (!existsSync(projectPath)) {
          console.warn(`Project path does not exist: ${projectPath}`);
          continue;
        }
        // Skip TLDR (being replaced with open-webUI)
        if (projectPath.includes('D-2510-006 TLDR') || projectPath.includes('/TLDR/')) {
          continue;
        }
        const project = await this.scanProject(projectPath);
        if (project) {
          projects.push(project);
          console.log(`Successfully scanned project: ${project.name} at ${projectPath}`);
        } else {
          console.warn(`Project at ${projectPath} is not a React project or could not be scanned`);
        }
      } catch (error: any) {
        console.error(`Error scanning project at ${projectPath}:`, error.message || error);
      }
    }

    return projects;
  }

  /**
   * Find React projects by searching for package.json files
   */
  private findReactProjects(root: string, maxDepth: number = 4, currentDepth: number = 0): string[] {
    const projects: string[] = [];
    
    if (currentDepth >= maxDepth) {
      return projects;
    }

    try {
      const entries = readdirSync(root, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(root, entry.name);
        
        // Skip node_modules and other common directories that shouldn't be scanned
        // Also skip TLDR (being replaced with open-webUI)
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'dist' || 
            entry.name === 'build' ||
            entry.name === 'venv' ||
            entry.name === '.venv' ||
            entry.name === '__pycache__' ||
            entry.name === '.git' ||
            entry.name === 'target' ||
            entry.name === '.next' ||
            entry.name === '.cache' ||
            entry.name === 'working' ||  // Skip working directories
            entry.name.toLowerCase().includes('working') ||  // Skip any "working" folders
            entry.name === 'backup' ||
            entry.name === 'old' ||
            entry.name.includes('D-2510-006 TLDR') ||  // Skip TLDR (replaced with open-webUI)
            entry.name === 'TLDR' ||
            fullPath.includes('D-2510-006 TLDR')) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check if this directory has a package.json
          const packageJsonPath = join(fullPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              // Check if it's a React project
              if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                projects.push(fullPath);
                // Don't recurse into React project directories (they're already found)
                continue;
              }
            } catch (e) {
              // Invalid package.json, continue searching
            }
          }
          
          // Recursively search subdirectories (even if package.json exists but isn't React)
          projects.push(...this.findReactProjects(fullPath, maxDepth, currentDepth + 1));
        }
      }
    } catch (error) {
      // Directory might not be accessible, skip
    }

    return projects;
  }

  /**
   * Scan all Python projects in the workspace
   */
  async scanAllPythonProjects(): Promise<PythonProject[]> {
    const projects: PythonProject[] = [];
    const isDocker = existsSync('/app');
    const operationsPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Operations'
      : '/home/lauchlandupreez/Operations';
    const managementPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Management'
      : '/home/lauchlandupreez/Management';

    // Find all Python projects
    const pythonPaths: string[] = [];
    if (existsSync(operationsPath)) {
      pythonPaths.push(...this.findPythonProjects(operationsPath, 6));
    }
    if (existsSync(managementPath)) {
      pythonPaths.push(...this.findPythonProjects(managementPath, 6));
    }

    const uniquePaths = Array.from(new Set(pythonPaths));

    for (const projectPath of uniquePaths) {
      try {
        if (!existsSync(projectPath)) {
          continue;
        }
        // Skip TLDR (being replaced with open-webUI)
        if (projectPath.includes('D-2510-006 TLDR') || projectPath.includes('/TLDR/')) {
          continue;
        }
        const project = await this.scanPythonProject(projectPath);
        if (project) {
          projects.push(project);
          console.log(`Successfully scanned Python project: ${project.name} at ${projectPath}`);
        }
      } catch (error: any) {
        console.error(`Error scanning Python project at ${projectPath}:`, error.message || error);
      }
    }

    return projects;
  }

  /**
   * Find Python projects by searching for requirements.txt files
   */
  private findPythonProjects(root: string, maxDepth: number = 6, currentDepth: number = 0): string[] {
    const projects: string[] = [];
    
    if (currentDepth >= maxDepth) {
      return projects;
    }

    try {
      const entries = readdirSync(root, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(root, entry.name);
        
        // Skip certain directories
        // Also skip TLDR (being replaced with open-webUI)
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'venv' ||
            entry.name === '.venv' ||
            entry.name === '__pycache__' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'working' ||
            entry.name.toLowerCase().includes('working') ||
            entry.name === '.tmp' ||
            entry.name.includes('D-2510-006 TLDR') ||  // Skip TLDR (replaced with open-webUI)
            entry.name === 'TLDR' ||
            fullPath.includes('D-2510-006 TLDR')) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check if this directory has a requirements.txt
          const requirementsPath = join(fullPath, 'requirements.txt');
          if (existsSync(requirementsPath)) {
            projects.push(fullPath);
            // Don't recurse into Python project directories (they're already found)
            continue;
          }
          
          // Recursively search subdirectories
          projects.push(...this.findPythonProjects(fullPath, maxDepth, currentDepth + 1));
        } else if (entry.isFile() && entry.name === 'requirements.txt') {
          // Found requirements.txt in current directory
          projects.push(root);
        }
      }
    } catch (error) {
      // Directory might not be accessible
    }

    return projects;
  }

  /**
   * Scan a single Python project for dependencies and vulnerabilities
   */
  async scanPythonProject(projectPath: string): Promise<PythonProject | null> {
    const requirementsPath = join(projectPath, 'requirements.txt');
    
    if (!existsSync(requirementsPath)) {
      return null;
    }

    try {
      const requirementsContent = readFileSync(requirementsPath, 'utf-8');
      const name = dirname(projectPath).split('/').pop() || 'unknown';
      
      // Parse requirements.txt
      const dependencies: DependencyInfo[] = [];
      const lines = requirementsContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('--')) {
          continue;
        }
        
        // Parse package line (format: package==version or package>=version, etc.)
        const match = trimmed.match(/^([a-zA-Z0-9_-]+[a-zA-Z0-9._-]*)(?:[=<>!]+(.+))?/);
        if (match) {
          const pkgName = match[1].toLowerCase();
          const version = match[2] ? this.cleanVersion(match[2]) : 'unknown';
          
          // Skip common non-package lines
          if (!['-r', '-e', '--', 'git+', 'http', 'https'].some(prefix => trimmed.startsWith(prefix))) {
            dependencies.push({
              name: pkgName,
              version: version,
            });
          }
        }
      }

      // Sort dependencies by name for better display
      dependencies.sort((a, b) => a.name.localeCompare(b.name));

      // Detect framework
      let framework: string | undefined;
      const allDeps = dependencies.map(d => d.name.toLowerCase());
      if (allDeps.includes('flask')) framework = 'Flask';
      else if (allDeps.includes('django')) framework = 'Django';
      else if (allDeps.includes('fastapi')) framework = 'FastAPI';
      else if (allDeps.includes('tornado')) framework = 'Tornado';
      else if (allDeps.includes('bottle')) framework = 'Bottle';
      else if (allDeps.some(d => d.includes('web'))) framework = 'Python Web';

      // Detect component type and app name
      const { componentType, appName } = this.detectComponentType(projectPath);

      // Scan for vulnerabilities
      const vulnerabilities = await this.scanPythonVulnerabilities(projectPath, dependencies);

      // Mark vulnerable dependencies
      vulnerabilities.forEach(vuln => {
        const dep = dependencies.find(d => d.name.toLowerCase() === vuln.package.toLowerCase());
        if (dep) {
          dep.vulnerable = true;
          dep.severity = vuln.severity;
        }
      });

      return {
        path: projectPath,
        name,
        framework,
        dependencies,
        vulnerabilities,
        lastScanned: new Date().toISOString(),
        requirementsPath,
        componentType,
        appName,
      };
    } catch (error) {
      console.error(`Error parsing requirements.txt at ${projectPath}:`, error);
      return null;
    }
  }

  /**
   * Scan Python dependencies for vulnerabilities using pip-audit or safety
   */
  private async scanPythonVulnerabilities(projectPath: string, dependencies: DependencyInfo[]): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // Check if requirements.txt exists
      const requirementsPath = join(projectPath, 'requirements.txt');
      if (!existsSync(requirementsPath)) {
        return vulnerabilities;
      }

      // Try pip-audit first (preferred)
      try {
        const auditOutput = execSync('pip-audit --format json --requirement requirements.txt', {
          cwd: projectPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 60000, // 60 second timeout
        }) as string;

        const auditData = JSON.parse(auditOutput);
        
        if (auditData.dependencies && Array.isArray(auditData.dependencies)) {
          auditData.dependencies.forEach((dep: any) => {
            if (dep.vulns && Array.isArray(dep.vulns)) {
              dep.vulns.forEach((vuln: any) => {
                vulnerabilities.push({
                  package: dep.name || 'unknown',
                  severity: this.mapPythonSeverity(vuln.id || 'unknown'),
                  title: vuln.id || dep.name || 'Unknown vulnerability',
                  description: vuln.description || undefined,
                  recommendation: vuln.fix_versions && vuln.fix_versions.length > 0 
                    ? `Upgrade to ${vuln.fix_versions.join(' or ')}` 
                    : undefined,
                });
              });
            }
          });
        }
        
        return vulnerabilities;
      } catch (pipAuditError: any) {
        // pip-audit not available or failed, try safety
        if (pipAuditError.code !== 'ENOENT' && pipAuditError.status !== 1) {
          console.warn(`pip-audit failed for ${projectPath}:`, pipAuditError.message);
        }
        // pip-audit exits with code 1 when vulnerabilities are found, so check stdout
        if (pipAuditError.stdout) {
          try {
            const auditData = JSON.parse(pipAuditError.stdout);
            if (auditData.dependencies && Array.isArray(auditData.dependencies)) {
              auditData.dependencies.forEach((dep: any) => {
                if (dep.vulns && Array.isArray(dep.vulns)) {
                  dep.vulns.forEach((vuln: any) => {
                    vulnerabilities.push({
                      package: dep.name || 'unknown',
                      severity: this.mapPythonSeverity(vuln.id || 'unknown'),
                      title: vuln.id || dep.name || 'Unknown vulnerability',
                      description: vuln.description || undefined,
                      recommendation: vuln.fix_versions && vuln.fix_versions.length > 0 
                        ? `Upgrade to ${vuln.fix_versions.join(' or ')}` 
                        : undefined,
                    });
                  });
                }
              });
            }
            return vulnerabilities;
          } catch (parseError) {
            // Failed to parse, continue to safety fallback
          }
        }
      }

      // Try safety as fallback
      try {
        const safetyOutput = execSync('safety check --json', {
          cwd: projectPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 60000,
        }) as string;

        const safetyData = JSON.parse(safetyOutput);
        
        if (safetyData.vulnerabilities && Array.isArray(safetyData.vulnerabilities)) {
          safetyData.vulnerabilities.forEach((vuln: any) => {
            vulnerabilities.push({
              package: vuln.package_name || 'unknown',
              severity: this.mapPythonSeverity(vuln.severity || 'unknown'),
              title: vuln.vulnerability_id || vuln.package_name || 'Unknown vulnerability',
              description: vuln.advisory || undefined,
              recommendation: vuln.spec || undefined,
            });
          });
        }
        
        return vulnerabilities;
      } catch (safetyError: any) {
        // Neither tool available - that's okay, we'll just return empty array
        if (safetyError.code !== 'ENOENT') {
          console.warn(`safety check failed for ${projectPath}:`, safetyError.message);
        }
      }

      // If neither tool is available, we could use pip list + check against a vulnerability DB
      // For now, return empty array
    } catch (error: any) {
      console.error(`Error running Python vulnerability scan for ${projectPath}:`, error.message || error);
    }

    // Always check against known vulnerabilities database as additional check
    const knownVulns = this.checkKnownVulnerabilities(dependencies);
    vulnerabilities.push(...knownVulns);

    // Deduplicate vulnerabilities by package and vulnerability ID
    const seen = new Set<string>();
    const uniqueVulnerabilities = vulnerabilities.filter(vuln => {
      const key = `${vuln.package.toLowerCase()}:${vuln.title || vuln.package}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return uniqueVulnerabilities;
  }

  /**
   * Known vulnerability database for manual checking
   */
  private getKnownVulnerabilities(): Array<{
    package: string;
    maxVersion: string;
    vulnerabilities: Array<{
      id: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
    }>;
  }> {
    return [
      {
        package: 'python-jose',
        maxVersion: '3.3.0',
        vulnerabilities: [
          {
            id: 'PYSEC-2024-232',
            severity: 'high',
            title: 'Algorithm confusion with OpenSSH ECDSA keys',
            description: 'python-jose through 3.3.0 has algorithm confusion with OpenSSH ECDSA keys and other key formats. This is similar to CVE-2022-29217.',
            recommendation: 'Upgrade to 3.4.0',
          },
          {
            id: 'PYSEC-2024-233',
            severity: 'high',
            title: 'JWT bomb denial of service',
            description: 'python-jose through 3.3.0 allows attackers to cause a denial of service (resource consumption) during a decode via a crafted JSON Web Encryption (JWE) token with a high compression ratio, aka a "JWT bomb." This is similar to CVE-2024-21319.',
            recommendation: 'Upgrade to 3.4.0',
          },
        ],
      },
      {
        package: 'cryptography',
        maxVersion: '44.0.0',
        vulnerabilities: [
          {
            id: 'CVE-2024-12797',
            severity: 'high',
            title: 'OpenSSL vulnerability in cryptography wheels',
            description: "pyca/cryptography's wheels include a statically linked copy of OpenSSL. The versions of OpenSSL included in cryptography 42.0.0-44.0.0 are vulnerable to a security issue. More details about the vulnerability itself can be found in https://openssl-library.org/news/secadv/20250211.txt.",
            recommendation: 'Upgrade to 44.0.1',
          },
        ],
      },
      {
        package: 'h11',
        maxVersion: '0.14.0',
        vulnerabilities: [
          {
            id: 'CVE-2025-43859',
            severity: 'high',
            title: 'Request smuggling vulnerability in chunked-coding parsing',
            description: "A leniency in h11's parsing of line terminators in chunked-coding message bodies can lead to request smuggling vulnerabilities under certain conditions. Fixed in h11 0.15.0.",
            recommendation: 'Upgrade to 0.16.0',
          },
        ],
      },
      {
        package: 'ecdsa',
        maxVersion: '*',
        vulnerabilities: [
          {
            id: 'CVE-2024-23342',
            severity: 'high',
            title: 'Minerva timing attack on P-256 curve',
            description: 'python-ecdsa has been found to be subject to a Minerva timing attack on the P-256 curve. Using the ecdsa.SigningKey.sign_digest() API function and timing signatures an attacker can leak the internal nonce which may allow for private key discovery. Both ECDSA signatures, key generation, and ECDH operations are affected. ECDSA signature verification is unaffected. The python-ecdsa project considers side channel attacks out of scope for the project and there is no planned fix.',
            recommendation: 'Consider using an alternative library with side-channel protection, or implement additional security measures',
          },
        ],
      },
    ];
  }

  /**
   * Check dependencies against known vulnerabilities
   */
  private checkKnownVulnerabilities(dependencies: DependencyInfo[]): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    const knownVulns = this.getKnownVulnerabilities();

    for (const dep of dependencies) {
      const depName = dep.name.toLowerCase();
      const knownVuln = knownVulns.find(kv => kv.package.toLowerCase() === depName);
      
      if (knownVuln) {
        // Check if version is vulnerable
        const depVersion = this.parseVersion(dep.version);
        const maxVulnVersion = knownVuln.maxVersion === '*' ? null : this.parseVersion(knownVuln.maxVersion);
        
        // If maxVersion is '*', all versions are vulnerable
        // Otherwise, check if current version is <= maxVulnVersion
        const isVulnerable = maxVulnVersion === null || 
          (depVersion && this.compareVersions(depVersion, maxVulnVersion) <= 0);
        
        if (isVulnerable) {
          // Add all vulnerabilities for this package
          knownVuln.vulnerabilities.forEach(vuln => {
            vulnerabilities.push({
              package: dep.name,
              severity: vuln.severity,
              title: vuln.title,
              description: vuln.description,
              recommendation: vuln.recommendation,
            });
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Parse version string into comparable parts
   */
  private parseVersion(version: string): number[] | null {
    if (!version || version === 'unknown') return null;
    const cleaned = version.replace(/[\^~>=<]/g, '').trim();
    const parts = cleaned.split('.').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    return parts;
  }

  /**
   * Compare two version arrays
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  private compareVersions(v1: number[], v2: number[]): number {
    const maxLength = Math.max(v1.length, v2.length);
    for (let i = 0; i < maxLength; i++) {
      const part1 = v1[i] || 0;
      const part2 = v2[i] || 0;
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  }

  /**
   * Map Python vulnerability severity to standard format
   */
  private mapPythonSeverity(severity: string): string {
    const s = severity.toLowerCase();
    if (s.includes('critical') || s === '9' || s === '10') return 'critical';
    if (s.includes('high') || s === '7' || s === '8') return 'high';
    if (s.includes('medium') || s.includes('moderate') || s === '4' || s === '5' || s === '6') return 'medium';
    if (s.includes('low') || s === '1' || s === '2' || s === '3') return 'low';
    return 'unknown';
  }

  /**
   * Scan a single project for dependencies and vulnerabilities
   */
  async scanProject(projectPath: string): Promise<ReactProject | null> {
    const packageJsonPath = join(projectPath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      console.warn(`package.json not found at ${packageJsonPath}`);
      return null;
    }

    try {
      const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      const name = packageJson.name || dirname(projectPath).split('/').pop() || 'unknown';
      
      // Check if it's a React project
      const reactVersion = packageJson.dependencies?.react || packageJson.devDependencies?.react;
      const reactDomVersion = packageJson.dependencies?.['react-dom'] || packageJson.devDependencies?.['react-dom'];
      
      if (!reactVersion && !reactDomVersion) {
        return null; // Not a React project
      }

      // Determine framework
      let framework: string | undefined;
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        framework = 'Next.js';
      } else if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
        framework = 'Vite';
      } else if (packageJson.dependencies?.['react-scripts'] || packageJson.devDependencies?.['react-scripts']) {
        framework = 'Create React App';
      } else {
        framework = 'React';
      }

      // Extract key dependencies
      const dependencies: DependencyInfo[] = [];
      
      // React core dependencies
      if (reactVersion) {
        dependencies.push({
          name: 'react',
          version: this.cleanVersion(reactVersion),
        });
      }
      
      if (reactDomVersion) {
        dependencies.push({
          name: 'react-dom',
          version: this.cleanVersion(reactDomVersion),
        });
      }

      // Framework version
      const nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next;
      if (nextVersion) {
        dependencies.push({
          name: 'next',
          version: this.cleanVersion(nextVersion),
        });
      }

      // Add other important React-related dependencies
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const importantPackages = [
        '@azure/msal-browser',
        '@azure/msal-react',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-slot',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toast',
        'axios',
        'lucide-react',
        'recharts',
        'tailwindcss',
        'typescript',
      ];

      importantPackages.forEach(pkgName => {
        if (allDeps[pkgName]) {
          dependencies.push({
            name: pkgName,
            version: this.cleanVersion(allDeps[pkgName]),
          });
        }
      });

      // Also add all dependencies that start with @radix-ui, @azure, or are common React libs
      Object.keys(allDeps).forEach(pkgName => {
        if (
          (pkgName.startsWith('@radix-ui/') || 
           pkgName.startsWith('@azure/') ||
           pkgName.includes('react') ||
           pkgName.startsWith('@types/react')) &&
          !dependencies.find(d => d.name === pkgName)
        ) {
          dependencies.push({
            name: pkgName,
            version: this.cleanVersion(allDeps[pkgName]),
          });
        }
      });

      // Sort dependencies by name for better display
      dependencies.sort((a, b) => a.name.localeCompare(b.name));

      // Scan for vulnerabilities
      const vulnerabilities = await this.scanVulnerabilities(projectPath);

      // Mark vulnerable dependencies
      vulnerabilities.forEach(vuln => {
        const dep = dependencies.find(d => d.name === vuln.package);
        if (dep) {
          dep.vulnerable = true;
          dep.severity = vuln.severity;
        }
      });

      // Helper to clean version string (reuse from above)
      const cleanVersion = (version: string) => {
        return version.replace(/[\^~>=<]/g, '').trim();
      };

      // Detect component type and app name from path
      const { componentType, appName } = this.detectComponentType(projectPath);

      return {
        path: projectPath,
        name,
        framework,
        reactVersion: reactVersion ? this.cleanVersion(reactVersion) : undefined,
        reactDomVersion: reactDomVersion ? this.cleanVersion(reactDomVersion) : undefined,
        nextVersion: nextVersion ? this.cleanVersion(nextVersion) : undefined,
        dependencies,
        vulnerabilities,
        lastScanned: new Date().toISOString(),
        packageJsonPath,
        componentType,
        appName,
      };
    } catch (error) {
      console.error(`Error parsing package.json at ${projectPath}:`, error);
      return null;
    }
  }

  /**
   * Run npm audit to check for vulnerabilities
   */
  private async scanVulnerabilities(projectPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // Check if package-lock.json or yarn.lock exists
      const hasLockFile = existsSync(join(projectPath, 'package-lock.json')) || 
                         existsSync(join(projectPath, 'yarn.lock')) ||
                         existsSync(join(projectPath, 'pnpm-lock.yaml'));

      if (!hasLockFile) {
        // No lock file means we can't run audit reliably
        console.warn(`No lock file found for ${projectPath}, skipping vulnerability scan`);
        return vulnerabilities;
      }

      // Check if node_modules exists (needed for npm audit)
      if (!existsSync(join(projectPath, 'node_modules'))) {
        console.warn(`node_modules not found for ${projectPath}, skipping vulnerability scan`);
        return vulnerabilities;
      }

      // Run npm audit --json
      // Note: npm audit exits with code 1 even when there are no vulnerabilities
      // So we need to catch the error and parse stdout
      let auditOutput: string;
      try {
        auditOutput = execSync('npm audit --json', {
          cwd: projectPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000, // 30 second timeout
        }) as string;
      } catch (execError: any) {
        // npm audit exits with code 1 even when successful with no vulnerabilities
        // Try to get stdout from the error
        auditOutput = execError.stdout || execError.output?.[1] || '';
        if (!auditOutput && execError.status !== 1) {
          // Only throw if it's not the expected exit code 1
          throw execError;
        }
      }

      const auditData = JSON.parse(auditOutput);
      return flattenNpmAuditVulnerabilityEntries(auditData);
    } catch (error: any) {
      // npm audit might fail if there are no vulnerabilities (exit code 1)
      // or if there are other issues
      // Try to parse stdout even if exit code is 1
      const output = error.stdout || error.output?.[1] || error.output?.[0];
      if (output) {
        try {
          const auditData = typeof output === 'string' ? JSON.parse(output) : output;
          return flattenNpmAuditVulnerabilityEntries(auditData);
        } catch (parseError) {
          // If parsing fails, just return empty array (no vulnerabilities found)
          // This is normal if npm audit exits with code 1 but has no vulnerabilities
          if (error.status !== 1) {
            console.warn(`Error parsing npm audit output for ${projectPath}:`, parseError);
          }
        }
      } else if (error.status !== 1) {
        // Only log if it's not the expected exit code 1 (no vulnerabilities)
        console.warn(`Error running npm audit for ${projectPath}:`, error.message || error);
      }
    }

    return vulnerabilities;
  }

  /**
   * Get current scan progress
   */
  getProgress(): ScanProgress {
    return { ...scanProgress };
  }

  /** Invalidate cached dependency summary (e.g. after npm repair). */
  clearSummaryCache(): void {
    summaryCache = null;
  }

  /**
   * Update scan progress
   */
  private updateProgress(updates: Partial<ScanProgress>) {
    scanProgress = { ...scanProgress, ...updates };
  }

  /**
   * Scan all React projects with progress tracking
   */
  private async scanAllProjectsWithProgress(): Promise<ReactProject[]> {
    const projects: ReactProject[] = [];
    
    // Adjust paths based on whether we're in Docker or on host
    const isDocker = existsSync('/app');
    const workspaceRoot = isDocker && existsSync('/workspace/lauchlandupreez') 
      ? '/workspace/lauchlandupreez' 
      : this.workspaceRoot;
    
    // Known specific project paths
    // Note: TLDR has been removed (replaced with open-webUI)
    const knownPaths = isDocker && existsSync('/workspace/lauchlandupreez') ? [
      '/workspace/lauchlandupreez/admin-center/frontend',
      '/workspace/lauchlandupreez/Operations/Gekko-Tracks/frontend',
      '/workspace/lauchlandupreez/Operations/Gekko-Tracks/backend',
    ] : isDocker ? [
      '/app/../frontend',
    ] : [
      '/home/lauchlandupreez/admin-center/frontend',
      '/home/lauchlandupreez/Operations/Gekko-Tracks/frontend',
      '/home/lauchlandupreez/Operations/Gekko-Tracks/backend',
    ];

    const operationsPath = isDocker && existsSync('/workspace/lauchlandupreez') 
      ? '/workspace/lauchlandupreez/Operations' 
      : '/home/lauchlandupreez/Operations';
    const managementPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Management'
      : '/home/lauchlandupreez/Management';
    
    const additionalPaths: string[] = [];
    
    if (existsSync(operationsPath)) {
      this.updateProgress({ currentStep: 'Scanning Operations folder...', progress: 10 });
      additionalPaths.push(...this.findReactProjects(operationsPath, 6));
    }
    
    if (existsSync(managementPath)) {
      this.updateProgress({ currentStep: 'Scanning Management folder...', progress: 15 });
      additionalPaths.push(...this.findReactProjects(managementPath, 6));
    }
    
    if (existsSync(workspaceRoot)) {
      this.updateProgress({ currentStep: 'Scanning workspace...', progress: 20 });
      additionalPaths.push(...this.findReactProjects(workspaceRoot, 5));
    }

    const allPaths = [...knownPaths, ...additionalPaths];
    const uniquePaths = Array.from(new Set(allPaths));
    
    this.updateProgress({ 
      currentStep: `Scanning ${uniquePaths.length} React projects...`, 
      progress: 25,
      totalSteps: uniquePaths.length,
      completedSteps: 0,
    });

    for (let i = 0; i < uniquePaths.length; i++) {
      const projectPath = uniquePaths[i];
      try {
        if (!existsSync(projectPath)) {
          continue;
        }
        // Skip TLDR (being replaced with open-webUI)
        if (projectPath.includes('D-2510-006 TLDR') || projectPath.includes('/TLDR/')) {
          continue;
        }
        const projectName = projectPath.split('/').pop() || projectPath;
        this.updateProgress({ 
          currentStep: `Scanning React project: ${projectName}...`,
          currentProject: projectPath,
          progress: 25 + Math.floor((i / uniquePaths.length) * 20),
          completedSteps: i,
        });
        
        const project = await this.scanProject(projectPath);
        if (project) {
          projects.push(project);
        }
      } catch (error: any) {
        const errors = scanProgress.errors || [];
        errors.push(`Error scanning ${projectPath}: ${error.message || error}`);
        this.updateProgress({ errors });
      }
    }

    return projects;
  }

  /**
   * Scan all Python projects with progress tracking
   */
  private async scanAllPythonProjectsWithProgress(): Promise<PythonProject[]> {
    const projects: PythonProject[] = [];
    const isDocker = existsSync('/app');
    const operationsPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Operations'
      : '/home/lauchlandupreez/Operations';
    const managementPath = isDocker && existsSync('/workspace/lauchlandupreez')
      ? '/workspace/lauchlandupreez/Management'
      : '/home/lauchlandupreez/Management';

    this.updateProgress({ currentStep: 'Finding Python projects...', progress: 50 });
    const pythonPaths: string[] = [];
    if (existsSync(operationsPath)) {
      pythonPaths.push(...this.findPythonProjects(operationsPath, 6));
    }
    if (existsSync(managementPath)) {
      pythonPaths.push(...this.findPythonProjects(managementPath, 6));
    }

    const uniquePaths = Array.from(new Set(pythonPaths));
    
    this.updateProgress({ 
      currentStep: `Scanning ${uniquePaths.length} Python projects...`,
      progress: 55,
      totalSteps: (scanProgress.totalSteps || 0) + uniquePaths.length,
    });

    for (let i = 0; i < uniquePaths.length; i++) {
      const projectPath = uniquePaths[i];
      try {
        if (!existsSync(projectPath)) {
          continue;
        }
        // Skip TLDR (being replaced with open-webUI)
        if (projectPath.includes('D-2510-006 TLDR') || projectPath.includes('/TLDR/')) {
          continue;
        }
        const projectName = projectPath.split('/').pop() || projectPath;
        this.updateProgress({ 
          currentStep: `Scanning Python project: ${projectName}...`,
          currentProject: projectPath,
          progress: 55 + Math.floor((i / uniquePaths.length) * 30),
          completedSteps: (scanProgress.completedSteps || 0) + i,
        });
        
        const project = await this.scanPythonProject(projectPath);
        if (project) {
          projects.push(project);
        }
      } catch (error: any) {
        const errors = scanProgress.errors || [];
        errors.push(`Error scanning ${projectPath}: ${error.message || error}`);
        this.updateProgress({ errors });
      }
    }

    return projects;
  }

  /**
   * Get summary statistics across all projects
   */
  async getSummary(forceRefresh: boolean = false): Promise<{
    totalProjects: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
    projects: ReactProject[];
    pythonProjects: PythonProject[];
    applications: ApplicationGroup[];
  }> {
    // Check cache first
    if (!forceRefresh && summaryCache && (Date.now() - summaryCache.timestamp) < CACHE_TTL) {
      console.log('Returning cached dependency summary');
      this.updateProgress({ isScanning: false, currentStep: 'Using cached data', progress: 100 });
      return summaryCache.data;
    }

    console.log('Scanning dependencies (cache miss or forced refresh)...');
    this.updateProgress({
      isScanning: true,
      currentStep: 'Initializing scan...',
      progress: 0,
      totalSteps: 0,
      completedSteps: 0,
      errors: [],
    });

    try {
      // Scan both React and Python projects with progress tracking
      const reactProjects = await this.scanAllProjectsWithProgress();
      const pythonProjects = await this.scanAllPythonProjectsWithProgress();
      
      this.updateProgress({ currentStep: 'Processing results...', progress: 90 });
      
      const allProjects = [...reactProjects, ...pythonProjects];
      
      let totalVulnerabilities = 0;
      let criticalVulnerabilities = 0;
      let highVulnerabilities = 0;
      let mediumVulnerabilities = 0;
      let lowVulnerabilities = 0;

      allProjects.forEach(project => {
        project.vulnerabilities.forEach(vuln => {
          totalVulnerabilities++;
          const severity = vuln.severity.toLowerCase();
          if (severity === 'critical') criticalVulnerabilities++;
          else if (severity === 'high') highVulnerabilities++;
          else if (severity === 'medium') mediumVulnerabilities++;
          else if (severity === 'low') lowVulnerabilities++;
        });
      });

      // Group projects by application (both React and Python)
      const applications = this.groupProjectsByApplication(reactProjects, pythonProjects);

      const result = {
        totalProjects: allProjects.length,
        totalVulnerabilities,
        criticalVulnerabilities,
        highVulnerabilities,
        mediumVulnerabilities,
        lowVulnerabilities,
        projects: reactProjects,
        pythonProjects,
        applications,
      };

      // Cache the result
      summaryCache = {
        data: result,
        timestamp: Date.now(),
      };

      this.updateProgress({
        isScanning: false,
        currentStep: 'Scan complete',
        progress: 100,
        completedSteps: scanProgress.totalSteps || 0,
      });

      return result;
    } catch (error: any) {
      this.updateProgress({
        isScanning: false,
        currentStep: 'Scan failed',
        errors: [...(scanProgress.errors || []), error.message || 'Unknown error'],
      });
      throw error;
    }
  }
}

export const dependenciesService = new DependenciesService();

