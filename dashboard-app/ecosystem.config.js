module.exports = {
  apps: [
    {
      name: 'family-dashboard',
      script: 'node_modules/.bin/electron',
      args: '.',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 50,
      min_uptime: 5000,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
