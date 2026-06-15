'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { IconType } from 'react-icons';
import {
  IoBulbOutline,
  IoChatbubbleEllipsesOutline,
  IoHeartOutline,
  IoLeafOutline,
  IoMusicalNotesOutline,
  IoPause,
  IoPlay,
  IoReorderThreeOutline,
} from 'react-icons/io5';
import AdviceCard from '../../../components/AdviceCard/AdviceCard';
import AnimaCoachPanel from '../AnimaCoachPanel/AnimaCoachPanel';
import KegelTrainer from '../KegelTrainer/KegelTrainer';
import { parentsData } from '../../parentsData';
import {
  PARENTS_LOCALE,
  PARENTS_MEDITATION_TRACKS,
  parentsPageText,
  parentsZoneTabs,
  type ParentsZoneTabId,
} from '../../parentsContent';
import s from './ParentsZone.module.scss';

const TAB_ICONS = {
  advice: IoBulbOutline,
  meditation: IoLeafOutline,
  anima: IoChatbubbleEllipsesOutline,
  health: IoHeartOutline,
} satisfies Record<ParentsZoneTabId, IconType>;

type ParentsMeditationTrackId = (typeof PARENTS_MEDITATION_TRACKS)[number]['id'];

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');

  return `${minutes}:${restSeconds}`;
}

export default function ParentsZone() {
  const [activeTab, setActiveTab] = useState<ParentsZoneTabId>('advice');
  const [activeTrackId, setActiveTrackId] = useState<ParentsMeditationTrackId>(
    PARENTS_MEDITATION_TRACKS[0].id,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedTrackIdRef = useRef<ParentsMeditationTrackId | null>(null);
  const playRequestIdRef = useRef(0);
  const preloadAudioRefs = useRef<
    Partial<Record<ParentsMeditationTrackId, HTMLAudioElement>>
  >({});

  const activeTrack = useMemo(() => (
    PARENTS_MEDITATION_TRACKS.find(track => track.id === activeTrackId)
    ?? PARENTS_MEDITATION_TRACKS[0]
  ), [activeTrackId]);

  useEffect(() => {
    const audio = audioRef.current;

    if (activeTab !== 'meditation' || !audio) {
      return;
    }

    if (!isPlaying) {
      playRequestIdRef.current += 1;
      audio.pause();
      return;
    }

    const playRequestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = playRequestId;

    if (loadedTrackIdRef.current !== activeTrack.id) {
      audio.load();
      loadedTrackIdRef.current = activeTrack.id;
    }

    void audio.play().catch(() => {
      if (playRequestIdRef.current !== playRequestId) {
        return;
      }

      // Сохраняем намерение игрока слушать трек: браузер может оборвать play
      // при load/src, но кнопка трека не должна сама откатывать состояние.
    });
  }, [activeTab, activeTrack.id, isPlaying]);

  useEffect(() => {
    if (activeTab !== 'meditation') {
      return;
    }

    PARENTS_MEDITATION_TRACKS.forEach(track => {
      if (preloadAudioRefs.current[track.id]) {
        return;
      }

      const preloadAudio = new Audio(track.source);
      preloadAudio.preload = 'auto';
      preloadAudio.load();
      preloadAudioRefs.current[track.id] = preloadAudio;
    });
  }, [activeTab]);

  const handleTrackClick = (trackId: ParentsMeditationTrackId) => {
    if (activeTrackId === trackId) {
      const audio = audioRef.current;

      if (audio?.ended) {
        audio.currentTime = 0;
        setCurrentTime('0:00');
        setProgress(0);
      }

      setIsPlaying(true);
      return;
    }

    setActiveTrackId(trackId);
    setCurrentTime('0:00');
    setProgress(0);
    setIsPlaying(true);
  };

  const handlePlayerToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    handleTrackClick(activeTrack.id);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    setCurrentTime(formatAudioTime(audio.currentTime));
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const nextProgress = Number(event.currentTarget.value);

    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      setProgress(nextProgress);
      return;
    }

    audio.currentTime = (audio.duration * nextProgress) / 100;
    setProgress(nextProgress);
    setCurrentTime(formatAudioTime(audio.currentTime));
  };

  const handleTrackEnd = () => {
    const currentIndex = PARENTS_MEDITATION_TRACKS.findIndex(
      track => track.id === activeTrack.id,
    );
    const nextTrack = PARENTS_MEDITATION_TRACKS[currentIndex + 1];

    setCurrentTime('0:00');
    setProgress(0);

    if (!nextTrack) {
      setIsPlaying(false);
      return;
    }

    setActiveTrackId(nextTrack.id);
    setIsPlaying(true);
  };

  return (
    <section className={s.zone}>
      <header className={s.header}>
        <h1>
          {parentsPageText.titleStart[PARENTS_LOCALE]}{' '}
          <span>{parentsPageText.titleAccent[PARENTS_LOCALE]}</span>
        </h1>
        <p>{parentsPageText.subtitle[PARENTS_LOCALE]}</p>
      </header>

      <div className={s.tabs} role="tablist" aria-label="Разделы родительской зоны">
        {parentsZoneTabs.map(tab => {
          const Icon = TAB_ICONS[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`parents-tab-${tab.id}`}
              type="button"
              className={`${s.tab} ${isActive ? s.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`parents-panel-${tab.id}`}
              aria-label={tab.ariaLabel[PARENTS_LOCALE]}
            >
              <Icon className={s.tabIcon} />
              <span>
                <strong>{tab.title[PARENTS_LOCALE]}</strong>
                <small>{tab.text[PARENTS_LOCALE]}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`parents-panel-${activeTab}`}
        className={s.panel}
        role="tabpanel"
        aria-labelledby={`parents-tab-${activeTab}`}
      >
        {activeTab === 'advice' ? (
          <section className={s.adviceSection} aria-labelledby="parents-advice-title">
            <div className={s.sectionHeader}>
              <h2 id="parents-advice-title">
                {parentsPageText.adviceTitle[PARENTS_LOCALE]}
              </h2>
              <p>{parentsPageText.adviceSubtitle[PARENTS_LOCALE]}</p>
            </div>

            <div className={s.adviceList}>
              {parentsData.map(post => (
                <AdviceCard
                  key={post.id}
                  title={post.title}
                  imageSrc={post.imageSrc}
                  imageAlt={post.imageAlt}
                  advices={post.advices}
                />
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'meditation' ? (
          <section className={s.meditationSection} aria-labelledby="parents-meditation-title">
            <div className={s.sectionHeader}>
              <h2 id="parents-meditation-title">
                {parentsPageText.meditationTitle[PARENTS_LOCALE]}
              </h2>
              <p>{parentsPageText.meditationSubtitle[PARENTS_LOCALE]}</p>
            </div>

            <div className={s.playlistShell}>
              <div className={s.playlist}>
                {PARENTS_MEDITATION_TRACKS.map(track => {
                  const isActive = activeTrack.id === track.id;
                  const isTrackPlaying = isActive && isPlaying;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      className={`${s.track} ${isActive ? s.trackActive : ''}`}
                      onClick={() => handleTrackClick(track.id)}
                      aria-pressed={isTrackPlaying}
                    >
                      <span className={s.trackButton} aria-hidden="true">
                        {isTrackPlaying ? <IoPause /> : <IoPlay />}
                      </span>
                      <span className={s.trackText}>
                        <strong>{track.title[PARENTS_LOCALE]}</strong>
                        <small>{track.duration}</small>
                      </span>
                      <IoReorderThreeOutline className={s.trackHandle} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>

              <div className={s.player}>
                <div className={s.playerTitle}>
                  <IoMusicalNotesOutline aria-hidden="true" />
                  <span>{activeTrack.title[PARENTS_LOCALE]}</span>
                </div>

                <div className={s.playerControls}>
                  <button
                    type="button"
                    className={s.playerButton}
                    onClick={handlePlayerToggle}
                    aria-label={isPlaying ? 'Поставить медитацию на паузу' : 'Включить медитацию'}
                  >
                    {isPlaying ? <IoPause /> : <IoPlay />}
                  </button>

                  <label className={s.progressLabel}>
                    <span>
                      {currentTime} / {activeTrack.duration}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={progress}
                      onChange={handleSeek}
                      aria-label="Позиция медитации"
                    />
                  </label>
                </div>

                <audio
                  ref={audioRef}
                  src={activeTrack.source}
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleTrackEnd}
                />
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'anima' ? (
          <AnimaCoachPanel />
        ) : null}

        {activeTab === 'health' ? (
          <KegelTrainer />
        ) : null}
      </div>
    </section>
  );
}
