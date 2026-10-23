import type { ParsedFile, FileType, Circuit } from '../types/hexagram';

export class FileParser {
  async parse(file: File): Promise<ParsedFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        resolve({
          name: file.name,
          size: file.size,
          type: this.classifyType(file.name, content),
          content,
          checksum: this.computeChecksum(content),
        });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  classifyType(filename: string, _content: string): FileType {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Code files -> Understanding Circuit (DFF-based, logical)
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(ext)) {
      return { circuit: 'understanding' as Circuit, family: 'code', ext };
    }
    // Web files -> Understanding Circuit
    if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext)) {
      return { circuit: 'understanding' as Circuit, family: 'web', ext };
    }
    // Data files -> Knowing Circuit (LSM-based, awareness)
    if (['json', 'csv', 'xml', 'yaml', 'yml', 'sql', 'md', 'txt'].includes(ext)) {
      return { circuit: 'knowing' as Circuit, family: 'data', ext };
    }
    // Config files -> Centering Circuit (DRN/DAE-based, identity)
    if (['toml', 'ini', 'conf', 'config', 'env', 'dockerfile', 'gitignore'].includes(ext)) {
      return { circuit: 'centering' as Circuit, family: 'config', ext };
    }
    // Media/unknown -> Sensing Circuit (DBN-based, experiential)
    return { circuit: 'sensing' as Circuit, family: 'media', ext };
  }

  computeChecksum(content: string): number {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  formatMimeType(type: FileType): string {
    return `${type.family}/${type.ext}`.toUpperCase();
  }
}
