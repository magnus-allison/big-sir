import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useService } from '@xstate/react';
import styled from 'styled-components/macro';
import {
  MdPause,
  MdPlayArrow,
  MdSkipPrevious,
  MdSkipNext,
} from 'react-icons/md';

import ShuffleIcon from '../icons/Shuffle';
import RepeatIcon from '../icons/Repeat';
import Scrubber from './Scrubber';
import VolumeSlider from './VolumeSlider';
import { useSpotifyContext } from '../SpotifyContext';
import { getToken, loadSpotifyWebPlayerScript } from '../utils';
import ClearButton from '../../ClearButton';
import { Context } from '../spotify.machine';

const REPEAT_MODES = ['off', 'track', 'context'];
const Player: FC = () => {
  const service = useSpotifyContext();
  const [, send] = useService<Context, any>(service);
  const player = useRef<Spotify.Player | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playerState, setPlayerState] = useState<
    Spotify.PlaybackState | undefined
  >();
  const shuffleRef = useRef(playerState?.shuffle);
  const [repeatMode, setRepeatMode] = useState(0);
  const token = getToken();
  const isPlaying = playerState?.paused !== undefined && !playerState?.paused;
  const isShuffleEnabled = playerState?.shuffle;
  /**
   * 0: NO_REPEAT
   * 1: ONCE_REPEAT
   * 2: FULL_REPEAT
   */
  const handleStateChange = useCallback(
    (state: Spotify.PlaybackState) => {
      setPlayerState(state);
      // types out of date
      // @ts-ignore
      const linkedFromId = state?.track_window?.current_track?.linked_from?.id;
      const trackId = state?.track_window?.current_track?.id ?? '';
      send({
        type: 'PLAY_TRACK',
        payload: { id: linkedFromId ?? trackId },
      });
    },
    [send]
  );

  useEffect(() => {
    if (player.current) {
      if (playerState?.paused) {
        player.current?.pause();
      } else {
        player.current?.resume();
      }
    }
  }, [playerState?.paused]);

  useEffect(() => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      setScriptReady(true);
      // @ts-ignore
      window.hasBeenLoaded = true;
    };

    loadSpotifyWebPlayerScript();
    return () => {
      player.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scriptReady && !player.current) {
      if (token) {
        player.current = new Spotify.Player({
          name: 'Web Playback SDK Quick Start Player',
          getOAuthToken: (cb) => {
            cb(token);
          },
        });
      }

      player.current?.addListener('ready', ({ device_id }) => {
        console.log('READY');
        console.log({ device_id });
        send({ type: 'PLAYER_INIT', payload: { deviceId: device_id } });
      });

      player.current?.connect();
    }
    if (player.current) {
      player.current?.addListener('player_state_changed', handleStateChange);
      return () => {
        player.current?.removeListener(
          'player_state_changed',
          handleStateChange
        );
      };
    }
  }, [scriptReady, handleStateChange, send, token]);

  useEffect(() => {
    // @ts-ignore
    if (window.hasBeenLoaded) {
      if (token) {
        player.current = new Spotify.Player({
          name: 'Web Playback SDK Quick Start Player',
          getOAuthToken: (cb) => {
            cb(token);
          },
        });
      }

      player.current?.addListener('ready', ({ device_id }) => {
        console.log('READY AGAIN');
        console.log({ device_id });
        send({ type: 'PLAYER_INIT', payload: { deviceId: device_id } });
      });

      player.current?.connect();
    }
    if (player.current) {
      player.current?.addListener('player_state_changed', handleStateChange);
      return () => {
        player.current?.removeListener(
          'player_state_changed',
          handleStateChange
        );
      };
    }
  }, [token, handleStateChange, send]);

  useEffect(() => {
    if (player.current) {
      if (isMuted) {
        player.current.setVolume(0.000001);
      } else {
        player.current.setVolume(volume);
      }
    }
  }, [volume, isMuted]);

  const handlePlayButtonClicked = () => {
    // @ts-ignore
    setPlayerState((state) => {
      return {
        ...state,
        paused: !state?.paused,
      };
    });
  };

  const handleShuffleClick = () => {
    const shuffle = async () => {
      try {
        shuffleRef.current = !shuffleRef.current;
        await fetch(
          `https://api.spotify.com/v1/me/player/shuffle?state=${shuffleRef.current}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (e) {
        shuffleRef.current = !shuffleRef.current;
        console.error(e);
      }
    };

    shuffle();
  };

  const handleRepeatClick = async () => {
    const shuffle = async () => {
      try {
        let tempIndex = (repeatMode + 1) % REPEAT_MODES.length;
        console.log({ tempIndex });
        await fetch(
          `https://api.spotify.com/v1/me/player/repeat?state=${REPEAT_MODES[tempIndex]}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setRepeatMode(tempIndex);
      } catch (e) {
        console.error(e);
      }
    };

    shuffle();
  };

  const handlePreviousClick = async () => {
    try {
      await player.current?.previousTrack();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextClick = async () => {
    try {
      await player.current?.nextTrack();
    } catch (e) {
      console.error(e);
    }
  };

  const updatePosition = useCallback((v: number) => {
    setPlayerState((state) => {
      if (state) {
        return {
          ...state,
          position: v,
        };
      }
    });
  }, []);

  const seek = async (v: number) => {
    try {
      await player.current?.seek(v);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Wrapper>
      {playerState && (
        <>
          <LeftColumn>
            <Metadata>
              <AlbumArt
                src={
                  playerState?.track_window?.current_track?.album?.images?.[1]
                    ?.url
                }
              />
              <SongInfo>
                <Title>{playerState?.track_window?.current_track?.name}</Title>
                <Artist>
                  {playerState?.track_window?.current_track?.artists?.[0]?.name}
                </Artist>
              </SongInfo>
            </Metadata>
          </LeftColumn>
          <Controls>
            <TopRow>
              <TopRowLeft>
                <ControlButton onClick={handleShuffleClick}>
                  <ShuffleIcon
                    stroke={isShuffleEnabled ? '#1db954' : '#b3b3b3'}
                  />
                </ControlButton>
                <ControlButton>
                  <MdSkipPrevious
                    onClick={handlePreviousClick}
                    color="#b3b3b3"
                    size={20}
                  />
                </ControlButton>
              </TopRowLeft>
              <PlayButton onClick={handlePlayButtonClicked}>
                {isPlaying ? (
                  <MdPause color="black" size={40} />
                ) : (
                  <MdPlayArrow color="black" size={40} />
                )}
              </PlayButton>
              <TopRowRight>
                <ControlButton>
                  <MdSkipNext
                    onClick={handleNextClick}
                    color="#b3b3b3"
                    size={20}
                  />
                </ControlButton>
                <ControlButton onClick={handleRepeatClick}>
                  <RepeatIcon
                    stroke={repeatMode !== 0 ? '#1db954' : '#b3b3b3'}
                    mode={repeatMode ?? 0}
                  />
                </ControlButton>
              </TopRowRight>
            </TopRow>
            <BottomRow>
              <Scrubber
                playerState={playerState}
                updatePosition={updatePosition}
                onChange={seek}
              />
            </BottomRow>
          </Controls>
          <RightColumn>
            <VolumeSlider
              volume={volume}
              setVolume={setVolume}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
            />
          </RightColumn>
        </>
      )}
    </Wrapper>
  );
};

const Metadata = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
`;
const BaseAnchor = styled.a`
  color: #b3b3b3;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: normal;
  line-height: 16px;
  text-transform: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;
const SongInfo = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
const Title = styled(BaseAnchor)`
  && {
    font-size: 14px;
    color: white;
  }
`;
const Artist = styled(BaseAnchor)`
  font-size: 11px;
`;
const AlbumArt = styled.img`
  height: 56px;
  width: 56px;
  margin-right: 5px;
`;
const LeftColumn = styled.div`
  min-width: 180px;
  width: 30%;
  height: 100%;
`;
const RightColumn = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  min-width: 180px;
  width: 30%;
`;
const TopRow = styled.div`
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  margin-bottom: 12px;
  width: 100%;
`;
const BottomRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;
const BaseTopControlSection = styled.div`
  gap: 8px;
  display: flex;
  flex: 1;
`;
const TopRowLeft = styled(BaseTopControlSection)`
  justify-content: flex-end;
`;
const TopRowRight = styled(BaseTopControlSection)``;
const Controls = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  max-width: 722px;
  width: 40%;
`;
const ControlButton = styled(ClearButton)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
`;
const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;
const PlayButton = styled(ClearButton)`
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 500px;
  background-color: #fff;
  color: #fff;
  width: 32px;
  height: 32px;
`;

export default Player;
