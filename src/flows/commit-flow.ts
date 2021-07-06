import { prompt } from 'inquirer'

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
