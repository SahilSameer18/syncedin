# Gemfile — Ruby dependencies for SyncedIn's mobile CI/CD.
# Installed automatically by ruby/setup-ruby@v1 in the GitHub Actions
# workflow (bundler-cache: true).
#
# Local dev (rare — most updates ship via Vercel without touching native):
#   gem install bundler
#   bundle install
#   bundle exec fastlane ios beta       # or: android beta
source "https://rubygems.org"

gem "fastlane", "~> 2.227"

plugins_path = File.join(File.dirname(__FILE__), "fastlane", "Pluginfile")
eval_gemfile(plugins_path) if File.exist?(plugins_path)
