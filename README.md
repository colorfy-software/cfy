# cfy

Jira integrated commiting CLI mainly to use at colorfy. After installing, just run `cfy` in any git project

<!-- toc -->

- [cfy](#cfy)
- [Usage](#usage)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @colorfy-software/cfy
$ cfy COMMAND
running command...
$ cfy (-v|--version|version)
@colorfy-software/cfy/0.0.17 darwin-x64 node-v14.17.6
$ cfy --help [COMMAND]
$ cfy -t | --ticket [To only take actions on tickets for specified project]
USAGE
  $ cfy COMMAND
...
```

<!-- usagestop -->

<!-- templating -->

To use a specific style of commits you can use the templating function in `./cfy-config.json`. Example:

```
"wip_flag_template": " | WIP",
"commit_type_case": "uppercase",
"template": "[%JIRA_TICKET_KEY%%WIP_FLAG%] - %COMMIT_TYPE% - %COMMIT_MESSAGE%"
```

Output: "[JIRA-567 | WIP] - FEAT - Created a feature"

<!-- templatingstop -->
