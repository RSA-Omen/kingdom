import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

export interface DependencyResolution {
  id: string; // filename without extension
  date: string; // ISO date string
  appName: string;
  packageName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string; // Markdown content
  fixedBy?: string; // Who fixed it
  relatedIssues?: string[]; // Related issue IDs or links
  verification?: string; // How it was verified
  metadata?: Record<string, any>;
}

class DependencyResolutionsService {
  private resolutionsDir: string;

  constructor() {
    // Store resolutions in data directory
    const dataDir = process.env.DATA_DIR || join(process.cwd(), '..', 'data');
    this.resolutionsDir = join(dataDir, 'dependency-resolutions');
    
    // Create directory if it doesn't exist
    if (!existsSync(this.resolutionsDir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(this.resolutionsDir, { recursive: true });
    }
  }

  /**
   * Parse frontmatter and content from markdown file
   */
  private parseMarkdownFile(filePath: string): DependencyResolution | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);
      
      if (!match) {
        // No frontmatter, try to parse as simple format
        return this.parseSimpleFormat(filePath, content);
      }
      
      const frontmatter = match[1];
      const body = match[2].trim();
      
      // Parse frontmatter (simple YAML-like parsing)
      const metadata: Record<string, any> = {};
      frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Handle arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayValue = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
            metadata[key] = arrayValue;
          } else {
            metadata[key] = value;
          }
        }
      });
      
      // Extract filename as ID
      const filename = require('path').basename(filePath, '.md');
      
      return {
        id: filename,
        date: metadata.date || new Date().toISOString().split('T')[0],
        appName: metadata.appName || metadata.app || 'Unknown',
        packageName: metadata.packageName || metadata.package || 'Unknown',
        severity: (metadata.severity || 'medium').toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
        title: metadata.title || metadata.name || 'Dependency Resolution',
        description: body,
        fixedBy: metadata.fixedBy || metadata.fixed_by,
        relatedIssues: Array.isArray(metadata.relatedIssues) ? metadata.relatedIssues : 
                      metadata.relatedIssues ? [metadata.relatedIssues] : undefined,
        verification: metadata.verification,
        metadata: metadata
      };
    } catch (error) {
      console.error(`Error parsing markdown file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse simple format without frontmatter
   */
  private parseSimpleFormat(filePath: string, content: string): DependencyResolution | null {
    const filename = require('path').basename(filePath, '.md');
    const lines = content.split('\n');
    
    // Try to extract basic info from first few lines
    let date = new Date().toISOString().split('T')[0];
    let appName = 'Unknown';
    let packageName = 'Unknown';
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let title = 'Dependency Resolution';
    
    // Look for common patterns
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('date:') || line.includes('fixed:')) {
        const dateMatch = lines[i].match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) date = dateMatch[1];
      }
      if (line.includes('app:') || line.includes('application:')) {
        appName = lines[i].split(':')[1]?.trim() || appName;
      }
      if (line.includes('package:') || line.includes('dependency:')) {
        packageName = lines[i].split(':')[1]?.trim() || packageName;
      }
      if (line.includes('severity:')) {
        const sev = lines[i].split(':')[1]?.trim().toLowerCase();
        if (['critical', 'high', 'medium', 'low'].includes(sev)) {
          severity = sev as any;
        }
      }
      if (line.includes('title:') || line.includes('issue:')) {
        title = lines[i].split(':').slice(1).join(':').trim() || title;
      }
    }
    
    return {
      id: filename,
      date,
      appName,
      packageName,
      severity,
      title,
      description: content
    };
  }

  /**
   * Get all resolutions for a date range
   */
  getResolutions(startDate?: string, endDate?: string): DependencyResolution[] {
    if (!existsSync(this.resolutionsDir)) {
      return [];
    }
    
    try {
      const files = readdirSync(this.resolutionsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => join(this.resolutionsDir, f))
        .filter(f => {
          // Filter by date if specified
          if (!startDate && !endDate) return true;
          
          const stats = statSync(f);
          const fileDate = stats.mtime.toISOString().split('T')[0];
          
          if (startDate && fileDate < startDate) return false;
          if (endDate && fileDate > endDate) return false;
          
          return true;
        });
      
      const resolutions = files
        .map(f => this.parseMarkdownFile(f))
        .filter((r): r is DependencyResolution => r !== null)
        .filter(r => {
          // Also filter by date in frontmatter if available
          if (!startDate && !endDate) return true;
          const resolutionDate = r.date;
          if (startDate && resolutionDate < startDate) return false;
          if (endDate && resolutionDate > endDate) return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
      
      return resolutions;
    } catch (error) {
      console.error('Error reading dependency resolutions:', error);
      return [];
    }
  }

  /**
   * Get resolutions for a specific week
   */
  getWeeklyResolutions(weekStart: Date, weekEnd: Date): DependencyResolution[] {
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = weekEnd.toISOString().split('T')[0];
    return this.getResolutions(startDate, endDate);
  }

  /**
   * Get resolution by ID
   */
  getResolution(id: string): DependencyResolution | null {
    const filePath = join(this.resolutionsDir, `${id}.md`);
    if (!existsSync(filePath)) {
      return null;
    }
    return this.parseMarkdownFile(filePath);
  }
}

export const dependencyResolutionsService = new DependencyResolutionsService();
