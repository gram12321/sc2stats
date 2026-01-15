import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Status tracking
let scraperStatus = {
  isRunning: false,
  lastRun: null,
  lastError: null,
  output: []
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get scraper status
app.get('/api/scraper/status', (req, res) => {
  res.json(scraperStatus);
});

// Run scraper endpoint
app.post('/api/scraper/run', (req, res) => {
  if (scraperStatus.isRunning) {
    return res.status(409).json({ 
      error: 'Scraper is already running',
      status: scraperStatus 
    });
  }

  // Reset status
  scraperStatus = {
    isRunning: true,
    lastRun: new Date().toISOString(),
    lastError: null,
    output: []
  };

  // Path to the Python scraper
  const scraperPath = path.join(__dirname, '..', 'tools', 'scraper', 'run_scraper.py');
  
  // Spawn Python process
  const pythonProcess = spawn('python', [scraperPath], {
    cwd: path.join(__dirname, '..', 'tools', 'scraper'),
    env: { 
      ...process.env, 
      PYTHONIOENCODING: 'utf-8',
      PYTHONLEGACYWINDOWSSTDIO: '1'
    }
  });

  // Handle output
  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Scraper output:', output);
    scraperStatus.output.push({
      type: 'stdout',
      message: output,
      timestamp: new Date().toISOString()
    });
  });

  pythonProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('Scraper error:', error);
    scraperStatus.output.push({
      type: 'stderr',
      message: error,
      timestamp: new Date().toISOString()
    });
  });

  // Handle process completion
  pythonProcess.on('close', (code) => {
    scraperStatus.isRunning = false;
    
    if (code === 0) {
      console.log('Scraper completed successfully');
      scraperStatus.output.push({
        type: 'success',
        message: `Scraper completed successfully (exit code: ${code})`,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`Scraper exited with code ${code}`);
      scraperStatus.lastError = `Scraper failed with exit code: ${code}`;
      scraperStatus.output.push({
        type: 'error', 
        message: `Scraper failed (exit code: ${code})`,
        timestamp: new Date().toISOString()
      });
    }
  });

  pythonProcess.on('error', (error) => {
    scraperStatus.isRunning = false;
    scraperStatus.lastError = error.message;
    scraperStatus.output.push({
      type: 'error',
      message: `Failed to start scraper: ${error.message}`,
      timestamp: new Date().toISOString()
    });
    console.error('Failed to start scraper:', error);
  });

  res.json({ 
    message: 'Scraper started successfully',
    status: scraperStatus 
  });
});

// Clear scraper output logs
app.delete('/api/scraper/logs', (req, res) => {
  scraperStatus.output = [];
  res.json({ message: 'Logs cleared' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 SC2 Stats API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Scraper status: http://localhost:${PORT}/api/scraper/status`);
});
