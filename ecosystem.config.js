module.exports = {
  apps: [
    {
      name: "official-backend",
      script: "./dist/server.js",
      cwd: "/home/ec2-user/Official-Backend",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "2G",
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 10000,
      node_args: "--max-old-space-size=2048",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "5s",
    },
  ],
};
