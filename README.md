# cfy

Jira integrated commiting CLI mainly to use at colorfy. After installing, just run `cfy` in any git project

# Usage

```sh-session
$ npm install -g @colorfy-software/cfy
$ cfy [In any git project]

$ cfy (-v | --version)

@colorfy-software/cfy/0.0.19 darwin-x64 node-v14.17.6

$ cfy --help [COMMAND]
$ cfy (-t | --ticket) [Take actions only on tickets without doing a commit]
```

# Template

<!-- templating -->

To use a specific style of commits you can use the templating function in `./cfy-config.json`. For example add this to the config file after you have run `cfy` and done initial project setup within a git project:

```json
"wip_flag_template": " | WIP",
"commit_type_case": "uppercase",
"template": "[%JIRA_TICKET_KEY%%WIP_FLAG%] - %COMMIT_TYPE% - %COMMIT_MESSAGE%"
```

Output: "[JIRA-567 | WIP] - FEAT - Created a feature"

<!-- templatingstop -->
