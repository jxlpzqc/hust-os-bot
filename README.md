# Hust OS Contribution Mail List Bot

## Build

### Prerequisite

node >= 14

### Install dependencies

```
npm install
```

### Debug Run

```
npm start

```

### Release build

```
npm run build
```

## Usage

### Environments

- SECRETS_FILE: file to secrets configuration, default `.secrets.json` 
- CRON_EXP: specify when to execute the schedule, default is every 3 minutes.
- CC_EMAIL: specify email to filter, default is HUST google groups email address.
