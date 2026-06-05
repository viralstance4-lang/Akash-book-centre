module.exports = {
  apps: [
    {
      name: "backend",
      script: "npm",
      args: "start",
      cwd: "/var/www/Akash-book-centre/backend",

      // Restart policy
      autorestart:       true,
      max_restarts:      10,
      restart_delay:     5000,   // 5s between restarts (prevents rapid crash loop)
      min_uptime:        "10s",  // must stay up 10s to count as stable

      // Memory: restart if > 400 MB (prevents memory leak crashes)
      max_memory_restart: "400M",

      // Env
      env_production: {
        NODE_ENV: "production",
      },

      // Logging
      out_file:   "/root/.pm2/logs/backend-out.log",
      error_file: "/root/.pm2/logs/backend-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
