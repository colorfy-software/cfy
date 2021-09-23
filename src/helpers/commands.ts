import { exec } from 'child_process'

export const runCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        reject(error.message)
      }

      if (stderr) {
        reject(stderr)
      }

      resolve(stdout)
    })
  })
}
