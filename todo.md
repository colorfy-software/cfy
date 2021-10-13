# ToDo

This is a list of todo's that should be implemented at some moment. As well a comprehensive list of missing features and known bugs

## Features

- [ ] Auto updater - When `cfy` command is run we check current CLI ver against most recent version on npm. If update is needed, we save it somewhere and on next run of CLI we offer the user the options to update to the latest version right after they run `cfy`. The reason I don't want to check ver on each run before anything else is to save time for the user. Would be cool to give the user an option to read change log diff between their and latest version.
- [ ] Error handling - Currently none existent. Most errors will just exit the CLI or print a cryptic message.
- [ ] Create Issue - Currently this action already exists on tickets, it just doesn't do anything. But if there's no issue available for a commit, then we should default to creating an issue, instead of continuing with no issue. This would require some sort of UI overhaul when selecting a ticket as well.

## Bugs

- [ ] When `cfy` is setting up config with project, there is a weird if statement, that has a bunch of `else if`, but no else and can fail silently. Requires some looking into
- [ ] After creating a commit with an issue, you need to select 5 to exit the menu. All menus should be exitable with just sending an empty value.
