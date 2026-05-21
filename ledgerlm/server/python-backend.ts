import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess: ChildProcess | null = null;

export function startPythonBackend() {
  if (pythonProcess) {
    console.log('Python backend is already running');
    return;
  }

  const pythonBackendDir = path.join(__dirname, '..', 'python_backend');
  
  console.log('Starting Python backend on port 8000...');
  
  pythonProcess = spawn('python3', [
    '-m',
    'uvicorn',
    'main:app',
    '--host',
    '0.0.0.0',
    '--port',
    '8000'
  ], {
    cwd: pythonBackendDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (pythonProcess.stdout) {
    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python Backend] ${data.toString().trim()}`);
    });
  }

  if (pythonProcess.stderr) {
    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message.includes('ERROR') || message.includes('CRITICAL')) {
        console.error(`[Python Backend ERROR] ${message}`);
      } else {
        console.log(`[Python Backend] ${message}`);
      }
    });
  }

  pythonProcess.on('close', (code) => {
    console.log(`Python backend exited with code ${code}`);
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err);
    pythonProcess = null;
  });

  console.log('Python backend started successfully');
}

export function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping Python backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// Cleanup on process exit
process.on('SIGINT', () => {
  stopPythonBackend();
  process.exit();
});

process.on('SIGTERM', () => {
  stopPythonBackend();
  process.exit();
});
