"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Upload, Play, Pause, Download, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { to } from "await-to-js";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoInfos, setVideoInfos] = useState<Record<string, any>[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<any>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rankingScore, setRankingScore] = useState<string>("final");
  const [isSearching, setIsSearching] = useState(false);


  const blobToFile = (blob: Blob, filename: string) => {
    return new File([blob], filename, { type: blob.type });
  };

  const startRecording = async () => {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      const RecordRTC = (await import('recordrtc')).default;

      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 44100,
        bufferSize: 16384,
      });

      recorderRef.current.startRecording();
      setIsRecording(true);
      setAudioUrl(null);
      setAudioFile(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast({
        title: "Microphone Error",
        description: "Failed to access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stopRecording(() => {
      const blob = recorderRef.current.getBlob();
      const file = blobToFile(blob, 'recording.mp3');

      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setIsRecording(false);
    });
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioFile) {
      return;
    }

    const link = document.createElement('a');
    link.href = audioUrl || '';
    link.download = audioFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const handleSubmit = async () => {
    if (!audioFile) {
      return;
    }
  
    setIsSearching(true); // Explicitly set searching to true
    setVideoInfos([]); // Clear previous video info
  
    const formData = new FormData();
    formData.append('file', audioFile);
  
    try {
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/results`;
      const [fetchError, response] = await to(fetch(endpoint, {
        method: 'POST',
        body: formData,
      }));
  
      if (fetchError || !response.ok) {
        console.error(fetchError?.stack);
        toast({
          title: "Error!",
          description: "Failed to request server.",
          variant: "destructive",
        });
        setIsSearching(false); // Reset searching state
        return;
      }
  
      const [jsonError, ranksPayload] = await to(response.json());
  
      if (jsonError || !ranksPayload?.result?.result) {
        toast({
          title: "Error!",
          description: "Internal server error.",
          variant: "destructive",
        });
        setIsSearching(false); // Reset searching state
        return;
      }
  
      const videoInfoPromises = ranksPayload.result.result.map(async (rank: any) => {
        try {
          const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/song/${rank['song_id']}`;
          const response = await fetch(endpoint);
          const payload = await response.json();
          const videoInfo = payload.result.result;
          videoInfo.audioScore = rank['score_audio'];
          videoInfo.textScore = rank['score_text'];
          videoInfo.finalScore = rank['synthesized_score'];
          return videoInfo;
        } catch {
          return null;
        }
      });
  
      const videoInfos = (await Promise.all(videoInfoPromises)).filter(info => info !== null);
      setVideoInfos(videoInfos);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error!",
        description: "Unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false); // Reset searching state
    }
  
    setAudioFile(null);
    setAudioUrl(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio')) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioFile(file);
      toast({
        title: 'File uploaded',
        description: 'MP3 file uploaded successfully.',
        variant: 'default',
      });
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a valid MP3 file.',
        variant: 'destructive',
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRankingScoreChange = (value: string) => {
    if (value === rankingScore) {
      return;
    }
    
    if (value == "final") {
      setVideoInfos(prev => prev.toSorted((a, b) => b.finalScore - a.finalScore))
    } else if (value == "audio") {
      setVideoInfos(prev => prev.toSorted((a, b) => b.audioScore - a.audioScore))
    } else if (value == "text") {
      setVideoInfos(prev => prev.toSorted((a, b) => b.textScore - a.textScore))
    }

    setRankingScore(value)
  }

  return (
    <main className='flex h-full'>
      <div className='w-full flex flex-col md:flex-row gap-4 p-4 h-full'>
        <Card className='h-fit w-full md:w-1/3'>
          <CardHeader>
            <CardTitle>Sound input</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col space-y-4'>
            <div className="grid grid-rows-2 grid-cols-1 sm:grid-rows-1 sm:grid-cols-2 gap-4">
              <Button
                disabled={isSearching}
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "default"}
              >
                {isRecording ? (
                  <>                
                    <Square />
                    <div>Stop</div>
                  </>
                ) : (
                  <>
                    <Mic />
                    <div>Record</div>
                  </>
                )
                }
              </Button>
              <Button 
                disabled={isSearching}
                onClick={triggerFileInput}
              >
                <Upload />
                <div>Upload</div>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept="audio/mp3"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </Button>
            </div>

            {audioUrl && (
              <>
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                <div className="grid grid-rows-2 grid-cols-1 md:grid-rows-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={togglePlayback}
                    variant="outline"
                    className="w-full"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Play
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleDownload}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSubmit}
              className="w-full"
              disabled={isSearching || !audioUrl}
            >
              <Search className="w-4 h-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </CardFooter>
        </Card>
        <Card className='w-full md:w-2/3 flex flex-col h-full'>
          <CardHeader className='flex flex-row justify-between'>
            <CardTitle>Search results</CardTitle>
            <div className='flex flex-row justify-center gap-2'>
              <Select value={rankingScore} onValueChange={handleRankingScoreChange}>
                <SelectTrigger className='flex flex-row gap-2 font-bold'>
                  <div className='font-light'>Ranked by:</div>
                  <SelectValue defaultValue={rankingScore} className='font-bold'></SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="final" className='font-bold'>Final Score</SelectItem>
                  <SelectItem value="audio" className='font-bold'>Audio Score</SelectItem>
                  <SelectItem value="text" className='font-bold'>Text Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className='flex flex-col h-full'>
            <div className='flex flex-col w-full max-h-[450px] md:max-h-[700px] overflow-y-scroll overflow-x-hidden'>
              {isSearching ? (
                <>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <Skeleton key={i} className='h-52 w-full my-2'></Skeleton>)}
                </>
              ) : (
                <>
                  {videoInfos.map((info, index) => (
                    <Card key={info.id} className='my-2 w-full'>
                      <CardHeader className='p-2'>
                        <CardTitle>
                          <div className='flex flex-row gap-2'>
                            <div>#{index + 1}</div>
                            {rankingScore == "final" && <div className='font-light'>Final score: <span className='italic'>{(info.finalScore / 1000).toFixed(3)}</span></div>}
                            {rankingScore == "audio" && <div className='font-light'>Audio score: <span className='italic'>{info.audioScore.toFixed(3)}</span></div>}
                            {rankingScore == "text" && <div className='font-light'>Text score: <span className='italic'>{(info.textScore / 100).toFixed(3)}</span></div>}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className='p-2'>
                        <Link href={info.url || ""}>
                          <div className="flex flex-row items-center space-x-2">
                            <img src={info.thumbnails ? info.thumbnails[0].url : ""} className="h-12 rounded-lg" />
                            <Button variant="link" className="whitespace-normal text-left h-fit p-1">
                              {info.title}
                            </Button>
                          </div>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AudioRecorder;
