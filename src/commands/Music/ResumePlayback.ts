import { ChatInputCommand, Command } from '@sapphire/framework';

import {
  getVoiceConnection,
  VoiceConnectionReadyState
} from '@discordjs/voice';

export class ResumePlaybackCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'resume',
      aliases: [],
      description: 'Resumes the video.',
      runIn: 'GUILD_ANY',
      preconditions: ['InVoiceChannel', 'IsPlaying']
    });
  }

  public override registerApplicationCommands(
    registry: ChatInputCommand.Registry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public chatInputRun(interaction: ChatInputCommand.Interaction) {
    // This command can only be run inside a guild.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const voiceConnection = getVoiceConnection(interaction.guildId!)!;

    const audioPlayer = (voiceConnection.state as VoiceConnectionReadyState)
      .subscription?.player;

    if (audioPlayer === undefined) {
      interaction.reply('❓ | There is no video playing.');
      return;
    }

    if (audioPlayer.state.status === 'playing') {
      interaction.reply('❓ | The video is already playing.');
      return;
    }

    audioPlayer.unpause();
    interaction.reply('▶️ | Resumed the video.');
    return;
  }
}
