- Add a question about which statuses the user wants to choose from when selecting tickets
- Store project id instead of project key, project key is useless
- Find a way how to add config file to .gitignore
- Figure out hpw to format JSON when storing config file
- Look into security when storing Jira api_token
- When choosing which ticket to attach the commit to, show interactive table with following options
  - Choose ticket from Jira
  - Create ticket in CLI
  - Write ticket number
  - Continue without adding a ticket number
- After commit message is created. Show interactive table with the following options
  - Move ticket to new column
  - Leave comment on the ticket
  - Assign ticket to a new person
  - Push commit
  - Exit
- Think about how to create an option to format the final message output. Probably something like we have in Somat with parsing vars out of POEditor. Define a bunch of variables. Like some basic DSL `[#{projectKey}-#{ticketNumber}#{wip}] | #{type} | #{message}`

## Flow

- Is project initialized?
  - No -> `cfy init`
  - Yes -> `cfy commit`

### cfy init

- Do you want to initialize the project from CLI?
  - No -> Create config file, and direct the user to it with some explanation
  - Yes -> Ask question
    - What's your domain
    - What's your email address
    - What's your API token
    - What's your preferred query
- Success!!
