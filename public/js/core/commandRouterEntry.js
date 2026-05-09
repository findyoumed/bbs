export function createEntryCommandHandler(deps) {
  const {
    showMain,
    handleLoginSubmit,
    handlePasswordResetSubmit,
    handlePasswordResetCancel,
    handleWriteSubmit,
    cancelPostWrite,
  } = deps;

  function isBackCommand(cmd) {
    return cmd === 'P' || cmd === 'M' || cmd === 'B';
  }

  return async function handleEntryCommand({ s, cmd, context }) {
    if (s === 'login') {
      if (cmd === 'LOGIN') {
        await handleLoginSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        await showMain();
        return true;
      }
      return true;
    }

    if (s === 'password-reset') {
      if (cmd === 'SEND' || cmd === 'CHANGE') {
        await handlePasswordResetSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        await handlePasswordResetCancel();
        return true;
      }
      return true;
    }

    if (s === 'post-write') {
      if (cmd === 'S' || cmd === 'SAVE') {
        await handleWriteSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        cancelPostWrite();
        return true;
      }
      return true;
    }

    return false;
  };
}
