import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { dependenciesService, ReactProject, PythonProject, Vulnerability } from './dependencies';
import { dependencyResolutionsService } from './dependencyResolutions';

export interface RepairResult {
  success: boolean;
  projectPath: string;
  projectName: string;
  appName: string;
  packageName: string;
  vulnerability: Vulnerability;
  action: 'upgraded' | 'patched' | 'skipped' | 'failed';
  oldVersion?: string;
  newVersion?: string;
  error?: string;
  resolutionFile?: string;
}

export interface RepairSummary {
  totalVulnerabilities: number;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: RepairResult[];
}

class DependencyRepairService {
  /**
   * Attempt to repair all vulnerabilities across all projects
   */
  async repairAll(dryRun: boolean = false): Promise<RepairSummary> {
    const summary = await dependenciesService.getSummary(true); // Force refresh
    const results: RepairResult[] = [];
    
    // Process React projects
    for (const project of summary.projects) {
      const projectResults = await this.repairProject(project, dryRun);
      results.push(...projectResults);
    }
    
    // Process Python projects
    for (const project of summary.pythonProjects) {
      const projectResults = await this.repairPythonProject(project, dryRun);
      results.push(...projectResults);
    }
    
    const summary_result: RepairSummary = {
      totalVulnerabilities: results.length,
      attempted: results.filter(r => r.action !== 'skipped').length,
      succeeded: results.filter(r => r.action === 'upgraded' || r.action === 'patched').length,
      failed: results.filter(r => r.action === 'failed').length,
      skipped: results.filter(r => r.action === 'skipped').length,
      results
    };

    if (!dryRun) {
      dependenciesService.clearSummaryCache();
    }

    return summary_result;
  }

  /**
   * Run npm audit fix once for the project (updates transitive deps in the lockfile).
   */
  private runNpmAuditFix(projectPath: string): void {
    try {
      execSync('npm audit fix', {
        cwd: projectPath,
        stdio: 'pipe',
        timeout: 120000
      });
    } catch {
      // npm exits 1 if vulnerabilities remain; lockfile may still be partially updated
    }
  }

  /**
   * Read resolved version of a package from package-lock.json (npm v7+ "packages" layout).
   */
  private getLockfileVersion(projectPath: string, packageName: string): string | null {
    const lockPath = join(projectPath, 'package-lock.json');
    if (!existsSync(lockPath)) return null;
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf-8')) as {
        packages?: Record<string, { version?: string }>;
      };
      const pkgs = lock.packages;
      if (!pkgs) return null;
      const suffix = `node_modules/${packageName}`;
      for (const key of Object.keys(pkgs)) {
        if (key === suffix || key.endsWith(`/${suffix}`)) {
          const v = pkgs[key]?.version;
          if (v) return v;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Total vulnerability count from npm audit (0 = clean).
   */
  private getNpmAuditVulnerabilityTotal(projectPath: string): number {
    try {
      const out = execSync('npm audit --json', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 120000
      });
      const j = JSON.parse(out) as { metadata?: { vulnerabilities?: { total?: number } } };
      return j.metadata?.vulnerabilities?.total ?? 0;
    } catch (e: unknown) {
      const stdout = e && typeof e === 'object' && 'stdout' in e ? String((e as { stdout?: Buffer }).stdout ?? '') : '';
      if (stdout) {
        try {
          const j = JSON.parse(stdout) as { metadata?: { vulnerabilities?: { total?: number } } };
          return j.metadata?.vulnerabilities?.total ?? 0;
        } catch {
          return -1;
        }
      }
      return -1;
    }
  }

  /**
   * picomatch has two major lines in typical Next/eslint trees (2.x under micromatch, 4.x under tinyglobby).
   * A single top-level override would break one chain; nest overrides under common parents.
   */
  private mergePicomatchOverrides(overrides: Record<string, unknown>): void {
    const mm =
      typeof overrides.micromatch === 'object' && overrides.micromatch !== null
        ? { ...(overrides.micromatch as Record<string, string>) }
        : {};
    const tg =
      typeof overrides.tinyglobby === 'object' && overrides.tinyglobby !== null
        ? { ...(overrides.tinyglobby as Record<string, string>) }
        : {};
    overrides.micromatch = { ...mm, picomatch: '2.3.2' };
    overrides.tinyglobby = { ...tg, picomatch: '4.0.4' };
  }

  /**
   * Force a patched transitive version via npm overrides, then npm install.
   */
  private async attemptTransitiveRepair(
    project: ReactProject,
    packageName: string,
    vuln: Vulnerability,
    dryRun: boolean,
    lockVersionBeforeAuditFix: string | null
  ): Promise<RepairResult> {
    const packageJsonPath = project.packageJsonPath;
    const oldLockVersion = lockVersionBeforeAuditFix;

    if (dryRun) {
      return {
        success: false,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'skipped',
        error: 'Dry run — would run npm audit fix and/or add npm overrides for transitive dependency',
        oldVersion: oldLockVersion || undefined
      };
    }

    let afterAudit = this.getLockfileVersion(project.path, packageName);
    const auditRemaining = this.getNpmAuditVulnerabilityTotal(project.path);

    if (afterAudit && afterAudit !== oldLockVersion) {
      const resolutionFile = await this.createResolutionFile({
        date: new Date().toISOString().split('T')[0],
        appName: project.appName || project.name,
        packageName,
        severity: vuln.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
        title: `Patched transitive ${packageName}: ${vuln.title}`,
        description: this.generateResolutionDescription(
          vuln,
          oldLockVersion || '(transitive)',
          afterAudit,
          'npm audit fix (transitive)'
        ),
        verification: 'npm audit fix updated lockfile'
      });
      return {
        success: true,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'patched',
        oldVersion: oldLockVersion || undefined,
        newVersion: afterAudit,
        resolutionFile
      };
    }

    if (auditRemaining === 0) {
      return {
        success: true,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'patched',
        oldVersion: oldLockVersion || undefined,
        newVersion: afterAudit || undefined,
        resolutionFile: undefined
      };
    }

    // Still vulnerable: add overrides
    let pkg: Record<string, any>;
    try {
      pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    } catch (e: any) {
      return {
        success: false,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'failed',
        error: e.message || 'Could not read package.json'
      };
    }

    if (!pkg.overrides || typeof pkg.overrides !== 'object') {
      pkg.overrides = {};
    }
    const o = pkg.overrides as Record<string, unknown>;

    if (packageName === 'picomatch') {
      this.mergePicomatchOverrides(o);
    } else {
      const latest = await this.getLatestVersion(packageName);
      if (!latest) {
        return {
          success: false,
          projectPath: project.path,
          projectName: project.name,
          appName: project.appName || 'Unknown',
          packageName,
          vulnerability: vuln,
          action: 'skipped',
          error: 'Could not resolve latest version from npm registry',
          oldVersion: oldLockVersion || undefined
        };
      }
      o[packageName] = `^${latest}`;
    }

    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

    try {
      execSync('npm install', {
        cwd: project.path,
        stdio: 'pipe',
        timeout: 180000
      });
    } catch (e: any) {
      return {
        success: false,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'failed',
        error: e.message || 'npm install failed after adding overrides',
        oldVersion: oldLockVersion || undefined
      };
    }

    afterAudit = this.getLockfileVersion(project.path, packageName);
    const resolutionFile = await this.createResolutionFile({
      date: new Date().toISOString().split('T')[0],
      appName: project.appName || project.name,
      packageName,
      severity: vuln.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
      title: `Overrides for transitive ${packageName}: ${vuln.title}`,
      description: this.generateResolutionDescription(
        vuln,
        oldLockVersion || '(transitive)',
        afterAudit || 'see lockfile',
        'npm overrides + npm install'
      ),
      verification: 'package.json overrides applied; run npm audit to confirm'
    });

    return {
      success: true,
      projectPath: project.path,
      projectName: project.name,
      appName: project.appName || 'Unknown',
      packageName,
      vulnerability: vuln,
      action: 'patched',
      oldVersion: oldLockVersion || undefined,
      newVersion: afterAudit || undefined,
      resolutionFile
    };
  }

  /**
   * Repair vulnerabilities in a React/Node project
   */
  private async repairProject(project: ReactProject, dryRun: boolean): Promise<RepairResult[]> {
    const results: RepairResult[] = [];
    
    if (!project.vulnerabilities || project.vulnerabilities.length === 0) {
      return results;
    }
    
    const packageJsonPath = project.packageJsonPath;
    if (!existsSync(packageJsonPath)) {
      return results;
    }
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const transitiveLockBefore = new Map<string, string | null>();
      for (const v of project.vulnerabilities) {
        const pn = v.package;
        if (allDeps[pn]) continue;
        if (!transitiveLockBefore.has(pn)) {
          transitiveLockBefore.set(pn, this.getLockfileVersion(project.path, pn));
        }
      }

      // One audit fix for the whole project before per-package work (helps transitive deps).
      if (!dryRun) {
        this.runNpmAuditFix(project.path);
      }

      const transitiveHandled = new Set<string>();
      
      for (const vuln of project.vulnerabilities) {
        const packageName = vuln.package;
        const currentVersion = allDeps[packageName];
        
        if (!currentVersion) {
          if (transitiveHandled.has(packageName)) continue;
          transitiveHandled.add(packageName);
          const tr = await this.attemptTransitiveRepair(
            project,
            packageName,
            vuln,
            dryRun,
            transitiveLockBefore.get(packageName) ?? null
          );
          results.push(tr);
          continue;
        }
        
        // Direct dependency: compare after initial audit fix
        try {
          if (!dryRun) {
            const updatedPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            const updatedDeps = { ...updatedPackageJson.dependencies, ...updatedPackageJson.devDependencies };
            const newVersion = updatedDeps[packageName];
            
            if (newVersion && newVersion !== currentVersion) {
              const resolutionFile = await this.createResolutionFile({
                date: new Date().toISOString().split('T')[0],
                appName: project.appName || project.name,
                packageName,
                severity: vuln.severity.toLowerCase() as any,
                title: `Fixed ${packageName} vulnerability: ${vuln.title}`,
                description: this.generateResolutionDescription(vuln, currentVersion, newVersion, 'npm audit fix'),
                verification: 'Automated fix via npm audit fix'
              });
              
              results.push({
                success: true,
                projectPath: project.path,
                projectName: project.name,
                appName: project.appName || 'Unknown',
                packageName,
                vulnerability: vuln,
                action: 'upgraded',
                oldVersion: currentVersion,
                newVersion,
                resolutionFile
              });
            } else {
              const manualResult = await this.attemptManualUpgrade(project, packageName, vuln, currentVersion, dryRun);
              results.push(manualResult);
            }
          } else {
            results.push({
              success: false,
              projectPath: project.path,
              projectName: project.name,
              appName: project.appName || 'Unknown',
              packageName,
              vulnerability: vuln,
              action: 'skipped',
              error: 'Dry run - would attempt npm audit fix / manual upgrade'
            });
          }
        } catch (error: any) {
          results.push({
            success: false,
            projectPath: project.path,
            projectName: project.name,
            appName: project.appName || 'Unknown',
            packageName,
            vulnerability: vuln,
            action: 'failed',
            error: error.message || 'Unknown error'
          });
        }
      }
    } catch (error: any) {
      console.error(`Error repairing project ${project.path}:`, error);
    }
    
    return results;
  }

  /**
   * Attempt manual upgrade of a package
   */
  private async attemptManualUpgrade(
    project: ReactProject,
    packageName: string,
    vuln: Vulnerability,
    currentVersion: string,
    dryRun: boolean
  ): Promise<RepairResult> {
    try {
      // Try to get latest version
      const latestVersion = await this.getLatestVersion(packageName);
      
      if (!latestVersion || latestVersion === currentVersion) {
        return {
          success: false,
          projectPath: project.path,
          projectName: project.name,
          appName: project.appName || 'Unknown',
          packageName,
          vulnerability: vuln,
          action: 'skipped',
          error: 'No newer version available or already at latest'
        };
      }
      
      if (!dryRun) {
        // Update package.json
        const packageJsonPath = project.packageJsonPath;
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Update in dependencies or devDependencies
        if (packageJson.dependencies && packageJson.dependencies[packageName]) {
          packageJson.dependencies[packageName] = `^${latestVersion}`;
        } else if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
          packageJson.devDependencies[packageName] = `^${latestVersion}`;
        }
        
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        
        // Run npm install
        execSync('npm install', {
          cwd: project.path,
          stdio: 'pipe',
          timeout: 120000
        });
        
        const resolutionFile = await this.createResolutionFile({
          date: new Date().toISOString().split('T')[0],
          appName: project.appName || project.name,
          packageName,
          severity: vuln.severity.toLowerCase() as any,
          title: `Upgraded ${packageName} from ${currentVersion} to ${latestVersion}`,
          description: this.generateResolutionDescription(vuln, currentVersion, latestVersion, 'manual upgrade'),
          verification: 'Automated upgrade via dependency repair service'
        });
        
        return {
          success: true,
          projectPath: project.path,
          projectName: project.name,
          appName: project.appName || 'Unknown',
          packageName,
          vulnerability: vuln,
          action: 'upgraded',
          oldVersion: currentVersion,
          newVersion: latestVersion,
          resolutionFile
        };
      } else {
        return {
          success: false,
          projectPath: project.path,
          projectName: project.name,
          appName: project.appName || 'Unknown',
          packageName,
          vulnerability: vuln,
          action: 'skipped',
          error: `Dry run - would upgrade to ${latestVersion}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName,
        vulnerability: vuln,
        action: 'failed',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Repair vulnerabilities in a Python project
   */
  private async repairPythonProject(project: PythonProject, dryRun: boolean): Promise<RepairResult[]> {
    const results: RepairResult[] = [];
    
    if (!project.vulnerabilities || project.vulnerabilities.length === 0) {
      return results;
    }
    
    // Python projects are more complex - for now, just document them
    for (const vuln of project.vulnerabilities) {
      results.push({
        success: false,
        projectPath: project.path,
        projectName: project.name,
        appName: project.appName || 'Unknown',
        packageName: vuln.package,
        vulnerability: vuln,
        action: 'skipped',
        error: 'Python dependency repair requires manual intervention'
      });
    }
    
    return results;
  }

  /**
   * Get latest version of a package from npm registry
   */
  private async getLatestVersion(packageName: string): Promise<string | null> {
    try {
      const output = execSync(`npm view ${packageName} version`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      return output.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate resolution description
   */
  private generateResolutionDescription(
    vuln: Vulnerability,
    oldVersion: string,
    newVersion: string,
    method: string
  ): string {
    return `## Summary
Automated fix for ${vuln.package} vulnerability: ${vuln.title}

## Changes Made
- Upgraded ${vuln.package} from ${oldVersion} to ${newVersion}
- Method: ${method}
- Vulnerability: ${vuln.title}
${vuln.description ? `- Description: ${vuln.description}` : ''}
${vuln.recommendation ? `- Recommendation: ${vuln.recommendation}` : ''}

## Testing
- Package upgraded successfully
- Dependencies installed
- Manual verification recommended

## Notes
This was an automated fix. Please verify the application still works correctly after this upgrade.`;
  }

  /**
   * Create resolution markdown file
   */
  private async createResolutionFile(resolution: {
    date: string;
    appName: string;
    packageName: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    verification?: string;
  }): Promise<string> {
    // Sanitize filename
    const sanitizedPackage = resolution.packageName.replace(/[^a-zA-Z0-9-._]/g, '-');
    const sanitizedDate = resolution.date.replace(/[^a-zA-Z0-9-._]/g, '-');
    const filename = `${sanitizedPackage}-fix-${sanitizedDate}.md`;
    
    // Use absolute path to data directory
    const dataDir = process.env.DATA_DIR || join(process.cwd(), '..', 'data');
    const resolutionsDir = join(dataDir, 'dependency-resolutions');
    const filepath = join(resolutionsDir, filename);
    
    // Ensure directory exists with proper permissions
    const { mkdirSync, chmodSync } = require('fs');
    if (!existsSync(resolutionsDir)) {
      mkdirSync(resolutionsDir, { recursive: true, mode: 0o755 });
    } else {
      // Ensure directory is writable
      try {
        chmodSync(resolutionsDir, 0o755);
      } catch (e) {
        // Ignore permission errors if we can't change it
      }
    }
    
    const content = `---
date: ${resolution.date}
appName: ${resolution.appName}
packageName: ${resolution.packageName}
severity: ${resolution.severity}
title: ${resolution.title}
verification: ${resolution.verification || 'Automated fix'}
---

${resolution.description}
`;
    
    writeFileSync(filepath, content, 'utf-8');
    return filename;
  }
}

export const dependencyRepairService = new DependencyRepairService();
