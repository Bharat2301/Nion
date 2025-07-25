import React, { useEffect, useRef, useState } from "react";
import { FaFolderOpen, FaDropbox, FaGoogleDrive } from "react-icons/fa";
import { FiArrowRight, FiDownload, FiRefreshCw } from "react-icons/fi";

declare global {
  interface Window {
    Dropbox: any;
    gapi: any;
    google: any;
    onApiLoad?: () => void;
  }
}

interface FileItem {
  file: File;
  showMenu: boolean;
  section: keyof FormatOptions;
  selectedFormat: string;
  source?: string;
  url?: string;
  id: string;
  selectedSubSection?: string;
}

interface FormatOptions {
  image: {
    image: string[];
    compressor: string[];
    pdf: string[];
  };
  pdfs: {
    document: string[];
    compressor: string[];
    ebook: string[];
    pdf_ebook: string[];
    pdf_to_image: string[];
  };
  audio: {
    audio: string[];
  };
  video: {
    audio: string[];
    device: string[];
    video: string[];
    compressor: string[];
    webservice: string[];
  };
  document: string[];
  archive: string[];
  ebook: string[];
}

interface ConvertedFile {
  name: string;
  url: string;
  loading: boolean;
  converting: boolean;
  originalId: string;
  error?: string;
}

export default function Dropbox() {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
  const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY || "";
  const API_URL = import.meta.env.VITE_API_URL || "https://convertorbackend.onrender.com";
  const CONVERSION_TIMEOUT = 120000; // Match backend's CONVERSION_TIMEOUT

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerLoaded = useRef(false);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Supported image formats for image-to-PDF conversion
  const supportedImageToPdfFormats = ["jpg", "jpeg", "png"];

  // Load Google APIs and Dropbox SDK
  useEffect(() => {
    const loadGapiAndGis = () => {
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.async = true;
      gapiScript.onload = () => {
        window.gapi.load("client:picker", async () => {
          try {
            await window.gapi.client.init({
              apiKey: GOOGLE_API_KEY,
              discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });
            pickerLoaded.current = true;
            console.log("Google API client initialized");
          } catch (err) {
            console.error("Failed to init gapi client:", err);
            setErrorMessage("Failed to initialize Google API client.");
          }
        });
      };
      gapiScript.onerror = () => {
        setErrorMessage("Failed to load Google API script.");
      };
      document.body.appendChild(gapiScript);

      const gisScript = document.createElement("script");
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.async = true;
      gisScript.onload = () => {
        console.log("Google Identity Services loaded");
      };
      gisScript.onerror = () => {
        setErrorMessage("Failed to load Google Identity Services script.");
      };
      document.body.appendChild(gisScript);

      const dropboxScript = document.createElement("script");
      dropboxScript.src = "https://www.dropbox.com/static/api/2/dropins.js";
      dropboxScript.id = "dropboxjs";
      dropboxScript.setAttribute("data-app-key", DROPBOX_APP_KEY);
      dropboxScript.async = true;
      dropboxScript.onerror = () => {
        setErrorMessage("Failed to load Dropbox SDK.");
      };
      document.body.appendChild(dropboxScript);
    };

    loadGapiAndGis();
  }, [GOOGLE_API_KEY, DROPBOX_APP_KEY]);

  // Map file extension to format section
  const getFormatSection = (ext: string): keyof FormatOptions => {
    ext = ext.toLowerCase();
    if (ext === "pdf") return "pdfs";
    if (["bmp", "eps", "gif", "ico", "png", "svg", "tga", "tiff", "wbmp", "webp", "jpg", "jpeg"].includes(ext))
      return "image";
    if (["doc", "docx", "txt", "rtf", "odt", "html", "ppt", "pptx", "xlsx"].includes(ext)) return "document";
    if (["mp3", "wav", "aac", "flac", "ogg", "opus", "wma", "aiff", "m4v", "mmf", "3g2"].includes(ext))
      return "audio";
    if (["mp4", "avi", "mov", "webm", "mkv", "flv", "wmv", "3gp", "mpg", "ogv"].includes(ext)) return "video";
    if (["zip", "7z"].includes(ext)) return "archive";
    if (["epub", "mobi", "azw3", "fb2", "lit", "lrf", "pdb", "tcr"].includes(ext)) return "ebook";
    return "image";
  };

  // Format options configuration
  const formatOptions: FormatOptions = {
    image: {
      image: ["BMP", "EPS", "GIF", "ICO", "JPG", "PNG", "SVG", "TGA", "WBMP"], // Removed TIFF, WEBP
      compressor: ["JPG", "PNG", "SVG"],
      pdf: ["PDF"],
    },
    pdfs: {
      document: ["DOCX"],
      compressor: ["PDF"],
      ebook: ["AZW3", "EPUB", "FB2", "LIT", "LRF", "MOBI", "PDB", "TCR"],
      pdf_ebook: ["AZW3", "EPUB", "FB2", "LIT", "LRF", "MOBI", "PDB", "TCR"],
      pdf_to_image: ["JPG", "PNG", "GIF"],
    },
    audio: {
      audio: ["AAC", "AIFF", "FLAC", "M4V", "MMF", "OGG", "OPUS", "WAV", "WMA", "3G2"],
    },
    video: {
      video: ["3G2", "3GP", "AVI", "FLV", "MKV", "MOV", "MPG", "OGV", "WEBM", "WMV"],
      audio: ["AAC", "AIFF", "FLAC", "M4V", "MMF", "MP3", "OGG", "OPUS", "WAV", "WMA", "3G2"],
      device: ["ANDROID", "BLACKBERRY", "IPAD", "IPHONE", "IPOD", "PLAYSTATION", "PSP", "WII", "XBOX"],
      compressor: ["MP4"],
      webservice: ["DAILYMOTION", "FACEBOOK", "INSTAGRAM", "TELEGRAM", "TWITCH", "TWITTER", "VIBER", "VIMEO", "WHATSAPP", "YOUTUBE"],
    },
    document: ["DOCX", "PDF", "TXT", "RTF", "ODT"],
    archive: ["ZIP", "7Z"],
    ebook: ["EPUB", "MOBI", "PDF", "AZW3"],
  };

  // Validate image file for PDF conversion
  const validateImageForPdf = (fileName: string): boolean => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return supportedImageToPdfFormats.includes(ext);
  };

  // Trigger Google Drive Picker
  const handleGoogleDriveUpload = () => {
    if (!pickerLoaded.current) {
      setErrorMessage("Google Picker is not ready. Please try again shortly.");
      return;
    }
    triggerGoogleSignIn();
  };

  // Initialize Google Sign-In
  const triggerGoogleSignIn = () => {
    if (!window.google?.accounts?.oauth2) {
      setErrorMessage("Google Identity Services not loaded. Please try again.");
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (response: any) => {
        if (response?.access_token) {
          console.log("Received access token:", response.access_token);
          setAccessToken(response.access_token);
          createGooglePicker(response.access_token);
        } else {
          console.error("No access token returned:", response);
          setErrorMessage("Google Sign-in failed: No access token received.");
        }
      },
    });

    tokenClient.requestAccessToken();
  };

  // Create Google Picker
  const createGooglePicker = (token: string) => {
    if (pickerLoaded.current && window.google?.picker && typeof window.google.picker.PickerBuilder === "function") {
      try {
        const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(GOOGLE_API_KEY)
          .setOrigin(window.location.origin)
          .setCallback((data: any) => handlePickerResponse(data, token))
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error("Failed to create Google Picker:", err);
        setErrorMessage("Failed to initialize Google Picker. Please try again.");
      }
    } else {
      setErrorMessage("Google Picker API not loaded. Please try again.");
    }
  };

  // Handle Google Picker response
  const handlePickerResponse = async (data: any, token: string) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const docs = data.docs;
      if (selectedFiles.length + docs.length > 5) {
        setErrorMessage("Maximum 5 files allowed.");
        return;
      }

      if (!token) {
        setErrorMessage("Access token missing. Please sign in again.");
        triggerGoogleSignIn();
        return;
      }

      const newFiles = await Promise.all(
        docs.map(async (doc: any) => {
          try {
            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!response.ok) {
              const errorData = await response.json();
              console.error("API error details:", errorData);
              if (response.status === 401) {
                setErrorMessage("Unauthorized access. Please sign in again.");
                setAccessToken(null);
                triggerGoogleSignIn();
                return null;
              }
              throw new Error(`Failed to fetch file: ${response.status}, ${errorData.error?.message}`);
            }
            const blob = await response.blob();
            const ext = doc.name.split(".").pop()?.toLowerCase() || "bin";
            const section = getFormatSection(ext);
            if (section === "image" && !supportedImageToPdfFormats.includes(ext)) {
              console.warn(`Unsupported image format for PDF conversion: ${ext}`);
              setErrorMessage(`File ${doc.name} has an unsupported format for PDF conversion. Use JPG, JPEG, or PNG.`);
              return null;
            }
            return {
              file: new File([blob], doc.name, { type: blob.type }),
              showMenu: false,
              section: section as keyof FormatOptions,
              selectedFormat: "",
              source: "google",
              url: doc.url,
              id: `${doc.name}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            };
          } catch (err) {
            console.error("Failed to fetch Google Drive file", doc.name, err);
            return null;
          }
        })
      );

      const validFiles = newFiles.filter((f): f is FileItem => f !== null);
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setConvertedFiles([]);
      setErrorMessage(null);
    }
  };

  // Handle local file upload
  const handleLocalFileClick = () => fileInputRef.current?.click();

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (selectedFiles.length + files.length > 5) {
        setErrorMessage("Maximum 5 files allowed.");
        return;
      }
      const newFiles = Array.from(files).map((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        const section = getFormatSection(ext);
        if (section === "image" && !supportedImageToPdfFormats.includes(ext)) {
          console.warn(`Unsupported image format for PDF conversion: ${ext}`);
          setErrorMessage(`File ${f.name} has an unsupported format for PDF conversion. Use JPG, JPEG, or PNG.`);
          return null;
        }
        return {
          file: f,
          showMenu: false,
          section: section as keyof FormatOptions,
          selectedFormat: "",
          source: "local",
          id: `${f.name}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        };
      });
      const validFiles = newFiles.filter((f): f is FileItem => f !== null);
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setConvertedFiles([]);
      if (validFiles.length < files.length) {
        setErrorMessage("Some files were not added due to unsupported formats for PDF conversion.");
      } else {
        setErrorMessage(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Dropbox upload
  const handleDropboxUpload = () => {
    if (!window.Dropbox) {
      setErrorMessage("Dropbox SDK not loaded. Please ensure the Dropbox script is included.");
      return;
    }
    window.Dropbox.choose({
      linkType: "direct",
      multiselect: true,
      extensions: [
        ".mp3", ".wav", ".aac", ".flac", ".ogg", ".opus", ".wma", ".aiff", ".m4v", ".mmf", ".3g2",
        ".mp4", ".avi", ".mov", ".webm", ".mkv", ".flv", ".wmv", ".3gp", ".mpg", ".ogv",
        ".png", ".jpg", ".jpeg", ".svg", ".bmp", ".gif", ".ico", ".tga", ".wbmp",
        ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".html", ".ppt", ".pptx", ".xlsx",
        ".zip", ".7z",
        ".epub", ".mobi", ".azw3", ".fb2", ".lit", ".lrf", ".pdb", ".tcr",
      ],
      success: async (files: any[]) => {
        if (selectedFiles.length + files.length > 5) {
          setErrorMessage("Maximum 5 files allowed.");
          return;
        }
        const newFiles = await Promise.all(
          files.map(async (f) => {
            try {
              const response = await fetch(f.link);
              if (!response.ok) throw new Error(`Failed to fetch Dropbox file: ${f.name}`);
              const blob = await response.blob();
              const ext = f.name.split(".").pop()?.toLowerCase() || "";
              const section = getFormatSection(ext);
              if (section === "image" && !supportedImageToPdfFormats.includes(ext)) {
                console.warn(`Unsupported image format for PDF conversion: ${ext}`);
                setErrorMessage(`File ${f.name} has an unsupported format for PDF conversion. Use JPG, JPEG, or PNG.`);
                return null;
              }
              return {
                file: new File([blob], f.name, { type: blob.type }),
                showMenu: false,
                section: section as keyof FormatOptions,
                selectedFormat: "",
                source: "dropbox",
                url: f.link,
                id: `${f.name}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
              };
            } catch (err) {
              console.error(`Error fetching Dropbox file ${f.name}:`, err);
              return null;
            }
          })
        );
        const validFiles = newFiles.filter((f): f is FileItem => f !== null);
        setSelectedFiles((prev) => [...prev, ...validFiles]);
        setConvertedFiles([]);
        if (validFiles.length < files.length) {
          setErrorMessage("Some files were not added due to unsupported formats for PDF conversion.");
        } else {
          setErrorMessage(null);
        }
      },
      error: (err: any) => {
        console.error("Dropbox picker error:", err);
        setErrorMessage("Failed to load files from Dropbox.");
      },
    });
  };

  // Toggle format selection menu
  const toggleMenu = (index: number) => {
    setSelectedFiles((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, showMenu: !item.showMenu } : { ...item, showMenu: false }
      )
    );
  };

  // Remove a selected file
  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setConvertedFiles((prev) => prev.filter((file) => file.originalId !== selectedFiles[index].id));
    setErrorMessage(null);
  };

  // Select a subsection for format options
  const selectSubSection = (index: number, subSection: string) => {
    const updated = [...selectedFiles];
    updated[index].selectedSubSection = subSection;
    updated[index].selectedFormat = "";
    setSelectedFiles(updated);
  };

  // Select a format for conversion
  const selectFormat = (index: number, format: string, subSection: string) => {
    const updated = [...selectedFiles];
    updated[index].selectedFormat = `${subSection}:${format}`;
    updated[index].showMenu = false;
    setSelectedFiles(updated);
  };

  // Retry conversion for a specific file
  const handleRetry = async (index: number) => {
    const fileItem = selectedFiles[index];
    if (!fileItem) return;

    const format = fileItem.selectedFormat.split(":");
    const subSection = format[0];
    const target = format[1];
    if (!subSection || !target) {
      setErrorMessage("Please select a format for the file.");
      return;
    }

    const formData = new FormData();
    formData.append("files", fileItem.file);
    formData.append(
      "formats",
      JSON.stringify([{
        name: fileItem.file.name,
        target: target.toLowerCase(),
        type: fileItem.section,
        subSection,
        id: fileItem.id,
      }])
    );

    setConvertedFiles((prev) =>
      prev.map((file) =>
        file.originalId === fileItem.id ? { ...file, converting: true, error: undefined } : file
      )
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error("Conversion request timed out after 120 seconds"));
      }, CONVERSION_TIMEOUT);

      const res = await fetch(`${API_URL}/api/convert`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Conversion failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("Retry conversion response:", data);

      const converted = await Promise.all(
        data.files.map(async (file: { name: string; path: string }) => {
          try {
            console.log(`Fetching converted file: ${file.name} from ${API_URL}${file.path}`);
            const fileRes = await fetch(`${API_URL}${file.path}`);
            if (!fileRes.ok) {
              throw new Error(`Failed to fetch converted file: ${file.name}, status: ${fileRes.status}`);
            }
            const blob = await fileRes.blob();
            const url = window.URL.createObjectURL(blob);
            return { name: file.name, url, loading: false, converting: false, originalId: fileItem.id };
          } catch (err) {
            console.error(`Error fetching file ${file.name}:`, err);
            return { name: file.name, url: "", loading: false, converting: false, originalId: fileItem.id, error: err.message };
          }
        })
      );

      setConvertedFiles((prev) =>
        prev.map((file) =>
          file.originalId === fileItem.id ? converted[0] : file
        )
      );

      if (converted[0].error) {
        setErrorMessage(`Retry failed for ${fileItem.file.name}: ${converted[0].error}`);
      } else {
        setErrorMessage(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error during retry";
      console.error("Retry conversion error:", msg);
      setConvertedFiles((prev) =>
        prev.map((file) =>
          file.originalId === fileItem.id ? { ...file, converting: false, error: msg } : file
        )
      );
      setErrorMessage(`Retry failed for ${fileItem.file.name}: ${msg}`);
    }
  };

  // Handle file conversion
  const handleConvert = async () => {
    if (isConverting) return;
    if (selectedFiles.length === 0) {
      setErrorMessage("No files selected for conversion.");
      return;
    }

    if (selectedFiles.some((item) => !item.selectedFormat)) {
      setErrorMessage("Please select a format for all files.");
      return;
    }

    if (selectedFiles.length > 5) {
      setErrorMessage("Maximum 5 files allowed.");
      return;
    }

    // Validate image-to-PDF conversions
    const invalidFiles = selectedFiles.filter(
      (item) => item.section === "image" && item.selectedFormat === "pdf:PDF" && !validateImageForPdf(item.file.name)
    );
    if (invalidFiles.length > 0) {
      setErrorMessage(
        `The following files have unsupported formats for PDF conversion: ${invalidFiles.map((f) => f.file.name).join(", ")}. Use JPG, JPEG, or PNG.`
      );
      return;
    }

    console.log("Starting conversion for files:", selectedFiles.map((item) => ({
      name: item.file.name,
      id: item.id,
      format: item.selectedFormat,
    })));

    const formData = new FormData();
    const formats = selectedFiles.map((item) => {
      const [subSection, target] = item.selectedFormat.split(":");
      return {
        name: item.file.name,
        target: target.toLowerCase(),
        type: item.section,
        subSection,
        id: item.id,
      };
    });

    setConvertedFiles(
      formats.map((format) => ({
        name: format.name,
        url: "",
        loading: false,
        converting: true,
        originalId: format.id,
        error: undefined,
      }))
    );

    selectedFiles.forEach((item) => {
      formData.append("files", item.file);
    });
    formData.append("formats", JSON.stringify(formats));

    setIsConverting(true);
    setErrorMessage(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error("Conversion request timed out after 120 seconds"));
      }, CONVERSION_TIMEOUT);

      const res = await fetch(`${API_URL}/api/convert`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Conversion failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("Conversion response:", data);

      const converted = await Promise.all(
        data.files.map(async (file: { name: string; path: string }, index: number) => {
          try {
            console.log(`Fetching converted file: ${file.name} from ${API_URL}${file.path}`);
            const fileRes = await fetch(`${API_URL}${file.path}`);
            if (!fileRes.ok) {
              throw new Error(`Failed to fetch converted file: ${file.name}, status: ${fileRes.status}`);
            }
            const blob = await fileRes.blob();
            const url = window.URL.createObjectURL(blob);
            const originalId = formats[index].id;
            return { name: file.name, url, loading: false, converting: false, originalId, error: undefined };
          } catch (err) {
            console.error(`Error fetching file ${file.name}:`, err);
            return { name: file.name, url: "", loading: false, converting: false, originalId: formats[index].id, error: err.message };
          }
        })
      );

      const validConverted = converted.filter((file): file is ConvertedFile => file.url !== "");
      setConvertedFiles(converted);
      if (converted.some((file) => file.error)) {
        setErrorMessage(
          `Some files failed to convert or download: ${converted
            .filter((file) => file.error)
            .map((file) => file.name)
            .join(", ")}. Click Retry to try again.`
        );
      } else if (validConverted.length === 0) {
        setErrorMessage("No files were converted successfully. Check file formats and try again.");
      } else {
        console.log("Conversion successful, files:", validConverted);
        setErrorMessage(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error during conversion";
      console.error("Conversion error details:", {
        message: msg,
        name: err.name,
        stack: err.stack,
      });
      setErrorMessage(
        msg.includes("timeout")
          ? "Conversion timed out after 120 seconds. Try smaller files or check server status."
          : `Conversion failed: ${msg}`
      );
      setConvertedFiles((prev) =>
        prev.map((file) => ({ ...file, converting: false, error: msg }))
      );
    } finally {
      setIsConverting(false);
    }
  };

  // Handle file download
  const handleDownload = async (url: string, name: string, index: number) => {
    setConvertedFiles((prev) =>
      prev.map((file, i) => (i === index ? { ...file, loading: true } : file))
    );
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      console.log(`Downloaded file: ${name}`);
    } catch (err) {
      console.error(`Error downloading file ${name}:`, err);
      setErrorMessage(`Failed to download ${name}. Please try again.`);
    } finally {
      setConvertedFiles((prev) =>
        prev.map((file, i) => (i === index ? { ...file, loading: false } : file))
      );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center space-y-2 converter-wrapper pt-10 m-4 rounded-md bg-white shadow-lg w-full max-w-3xl">
          <div className="bg-red-500 text-white gap-4 rounded-md px-8 py-6 flex items-center space-x-6 shadow-md w-[50%] justify-center">
            <span className="font-semibold text-[15px]">Choose Files</span>
            <FaFolderOpen
              onClick={handleLocalFileClick}
              title="Upload from device"
              className="text-white text-[26px] cursor-pointer hover:scale-110 transition"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleLocalFileChange}
              style={{ display: "none" }}
              accept=".mp3,.wav,.aac,.flac,.ogg,.opus,.wma,.aiff,.m4v,.mmf,.3g2,.mp4,.avi,.mov,.webm,.mkv,.flv,.wmv,.3gp,.mpg,.ogv,.png,.jpg,.jpeg,.svg,.bmp,.gif,.ico,.tga,.wbmp,.pdf,.doc,.docx,.txt,.rtf,.odt,.html,.ppt,.pptx,.xlsx,.zip,.7z,.epub,.mobi,.azw3,.fb2,.lit,.lrf,.pdb,.tcr"
            />
            <FaDropbox
              onClick={handleDropboxUpload}
              title="Upload from Dropbox"
              className="text-white text-[26px] cursor-pointer hover:scale-110 transition"
            />
            <FaGoogleDrive
              onClick={handleGoogleDriveUpload}
              title="Upload from Google Drive"
              className="text-white text-[26px] cursor-pointer hover:scale-110 transition"
            />
          </div>
          <div className="dropboxfoot mt-3 text-sm text-gray-400">
            100 MB maximum file size and up to 5 files. For image to PDF, use JPG, JPEG, or PNG.
          </div>
          {errorMessage && (
            <div className="mt-4 text-red-500 text-sm font-medium">{errorMessage}</div>
          )}
          <div className="mt-6 w-full max-w-2xl space-y-3">
            {selectedFiles.map((item, index) => {
              const convertedFile = convertedFiles.find((file) => file.originalId === item.id);
              console.log(
                `Checking match for ${item.file.name} (ID: ${item.id}):`,
                convertedFile ? convertedFile.name : "No match"
              );
              return (
                <div
                  key={item.id}
                  className="relative bg-white text-gray-700 rounded-md px-4 py-3 shadow-md border mb-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {convertedFile?.converting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-t-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
                          <span className="text-sm text-gray-400" aria-live="polite">Converting...</span>
                        </div>
                      ) : (
                        <span className="text-xl">📄</span>
                      )}
                      <p className="truncate max-w-[160px] text-sm font-medium">{item.file.name}</p>
                      <span className="text-sm text-gray-400">to</span>
                      <button
                        className="bg-gray-200 hover:bg-gray-300 text-sm rounded-md px-2 py-1"
                        onClick={() => toggleMenu(index)}
                        disabled={convertedFile?.converting}
                      >
                        {item.selectedFormat.split(":")[1] || "Select format"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {convertedFile && !convertedFile.converting && (
                        <>
                          {convertedFile.error ? (
                            <button
                              onClick={() => handleRetry(index)}
                              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-1 rounded-md text-[14px] font-semibold hover:bg-blue-600 transition"
                            >
                              <FiRefreshCw className="text-[16px]" />
                              Retry
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleDownload(
                                  convertedFile.url,
                                  convertedFile.name,
                                  convertedFiles.findIndex((file) => file.originalId === item.id)
                                )
                              }
                              disabled={convertedFile.loading}
                              className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-1 rounded-md text-[14px] font-semibold hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FiDownload className="text-[16px]" />
                              {convertedFile.loading ? "Downloading..." : "Download"}
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="text-gray-400 hover:text-red-500 transition text-xl"
                        onClick={() => removeFile(index)}
                        disabled={convertedFile?.converting}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {convertedFile?.error && (
                    <div className="mt-2 text-red-500 text-xs">{convertedFile.error}</div>
                  )}
                  {item.showMenu && (
                    <div className="absolute top-full mt-2 right-12 bg-[#1f1f1f] text-white rounded-md p-4 w-[340px] shadow-xl text-sm font-medium z-50 flex">
                      <div className="flex flex-col border-r border-gray-700 pr-3 min-w-[100px]">
                        {Object.keys(formatOptions[item.section]).map((subSection) => (
                          <button
                            key={subSection}
                            className={`text-left px-2 py-1 rounded hover:bg-[#333] ${item.selectedSubSection === subSection ? "text-white font-bold" : "text-gray-400"}`}
                            onClick={() => selectSubSection(index, subSection)}
                          >
                            {subSection.charAt(0).toUpperCase() + subSection.slice(1).replace("_", " ")}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 pl-4">
                        <div className="grid grid-cols-2 gap-2">
                          {formatOptions[item.section][
                            item.selectedSubSection || Object.keys(formatOptions[item.section])[0]
                          ].map((format) => (
                            <button
                              key={format}
                              className="bg-[#333] hover:bg-red-600 transition px-3 py-2 rounded text-white text-xs"
                              onClick={() =>
                                selectFormat(
                                  index,
                                  format,
                                  item.selectedSubSection || Object.keys(formatOptions[item.section])[0]
                                )
                              }
                            >
                              {format}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center space-y-2 rounded-md">
        <h1 className="text-gray-500 text-center mt-4">
          Make sure you have uploaded valid files. For image to PDF, use JPG, JPEG, or PNG.
        </h1>
        <button
          onClick={handleConvert}
          disabled={isConverting || selectedFiles.length === 0}
          className={`flex items-center gap-2 bg-red-400 text-white px-5 py-2 rounded-md text-[15px] font-semibold mt-2 hover:bg-red-500 transition ${isConverting || selectedFiles.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <FiArrowRight className="text-[16px]" />
          {isConverting ? "Converting..." : "Convert files"}
        </button>
      </div>
    </div>
  );
}