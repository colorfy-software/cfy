import { prompt } from 'inquirer'
import { User } from 'jira.js/out/version2/models'

export const commitTypeQuestion = async (
  defaultMessage?: string,
): Promise<{
  type: string
  wip: boolean
  message: string
}> => {
  const output = await prompt([
    {
      type: 'list',
      name: 'type',
      message: "What's the type of your commit",
      default: {
        name: '✨ FEAT - A new feature',
        value: 'feat',
      },
      choices: [
        {
          name: '✨ FEAT - A new feature',
          value: 'feat',
        },
        {
          name: '🐛 FIX - A bug fix',
          value: 'fix',
        },
        {
          name: '📚 DOCS - Documentation only changes',
          value: 'docs',
        },
        {
          name: '💎 STYLE - Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
          value: 'style',
        },
        {
          name: '📦 REFACTOR - A code change that neither fixes a bug nor adds a feature',
          value: 'refactor',
        },
        {
          name: '🚀 PERF - A code change that improves performance',
          value: 'perf',
        },
        {
          name: '🚨 TEST - Adding missing tests or correcting existing tests',
          value: 'test',
        },
        {
          name: '🛠 BUILD - Changes that affect the build system or external dependencies (example scopes: yarn, scripts, appcenter etc)',
          value: 'build',
        },
        {
          name: "♻️ CHORE - Other changes that don't modify src or test files",
          value: 'chore',
        },
        {
          name: '🗑 REVERT - Reverts a previous commit',
          value: 'revert',
        },
      ],
    },
    {
      type: 'confirm',
      name: 'wip',
      message: 'Is it WIP?',
      default: false,
    },
    {
      type: 'input',
      name: 'message',
      message: 'Describe the commit',
      default: `${defaultMessage}`,
    },
  ])

  return output
}

export const whatToDoWithSingleIssue = async (): Promise<{ next: number }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'next',
      message: 'Do you want to do anything with the ticket?',
      choices: [
        {
          name: '1. Add comment to the ticket',
          value: 1,
        },
        {
          name: '2. Move ticket to another status',
          value: 2,
        },
        {
          name: '3. Update time spent on Ticket',
          value: 3,
        },
        {
          name: '4. Reassign ticket to another person',
          value: 4,
        },
        {
          name: '5. Select another ticket',
          value: 5,
        },
        {
          name: '6. Exit',
          value: 6,
        },
      ],
    },
  ])

  return output
}

export const whatToDoWithMultiIssue = async (): Promise<{ next: number }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'next',
      message: 'Do you want to do anything with the ticket?',
      choices: [
        {
          name: '1. Add comment to the ticket',
          value: 1,
        },
        {
          name: '2. Move ticket to another status',
          value: 2,
        },
        {
          name: '3. Exit',
          value: 3,
        },
      ],
    },
  ])

  return output
}

export const assignIssueTo = async (users: User[]): Promise<{ user: string }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'user',
      message: 'Who do you want to assign the ticket to',
      choices: users.map(user => user.displayName),
    },
  ])

  return output
}

export const moveIssueToStatus = async (statuses: string[]): Promise<{ newStatus: string }> => {
  const output = await prompt([
    {
      type: 'search-list',
      name: 'newStatus',
      message: 'Which status do you want to move the ticket to?',
      choices: statuses,
    },
  ])

  return output
}

export const addCommentToIssueInput = async (): Promise<{ comment: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'comment',
      message: 'Comment to add to the ticket',
      validate(value) {
        if (value.length === 0) {
          return 'Sorry, you need to enter something here'
        }

        return true
      },
    },
  ])

  return output
}

export const amountOfTimeEstimated = async (): Promise<{ time: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'time',
      message: 'Add original estimate. (use format: #m || #h || #d. e.g. 4h for 4 hours)',
    },
  ])

  return output
}

export const amountOfTimeSpent = async (): Promise<{ time: string }> => {
  const output = await prompt([
    {
      type: 'input',
      name: 'time',
      message: 'Add amount of time spent on the ticket. (use format: #m || #h || #d. e.g. 4h for 4 hours)',
    },
  ])

  return output
}
