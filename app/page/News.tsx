"use client";

import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { Newspaper, Layers, X } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: "pinned" | "regular";
  createdAt: number;
}

interface NewsProps {
  showPopup: (type: "success" | "error" | "warning", title: string, text: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function News({ showPopup, showConfirm }: NewsProps) {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState<boolean>(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsType, setNewsType] = useState<"pinned" | "regular">("regular");
  const [addingNews, setAddingNews] = useState(false);

  // Fetch News
  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const colRef = collection(db, "news");
      const snapshot = await getDocs(colRef);
      const newsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as NewsItem[];
      newsData.sort((a, b) => b.createdAt - a.createdAt);
      setNewsList(newsData);
    } catch (err: any) {
      console.error("Error fetching news:", err);
    } finally {
      setLoadingNews(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) {
      showPopup("warning", "Missing Fields", "Please enter both title and content for the news.");
      return;
    }
    try {
      setAddingNews(true);
      const docRef = await addDoc(collection(db, "news"), {
        title: newsTitle.trim(),
        content: newsContent.trim(),
        type: newsType,
        createdAt: Date.now(),
      });
      const newNewsItem: NewsItem = {
        id: docRef.id,
        title: newsTitle.trim(),
        content: newsContent.trim(),
        type: newsType,
        createdAt: Date.now(),
      };
      setNewsList([newNewsItem, ...newsList]);
      setNewsTitle("");
      setNewsContent("");
      setNewsType("regular");
      showPopup("success", "News Added", "News item successfully added.");
    } catch (err: any) {
      console.error("Error adding news:", err);
      showPopup("error", "Failed to Add News", err.message);
    } finally {
      setAddingNews(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    showConfirm("Delete News", "Are you sure you want to delete this news item?", async () => {
      try {
        await deleteDoc(doc(db, "news", id));
        setNewsList(newsList.filter((item) => item.id !== id));
        showPopup("success", "News Deleted", "News item successfully deleted.");
      } catch (err: any) {
        console.error("Error deleting news:", err);
        showPopup("error", "Failed to Delete News", err.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Create Announcement Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-slate-700" />
            <h2 className="text-xs font-semibold text-slate-900">
              Publish Campus Announcement
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">Real-time broadcast to mobile apps</span>
        </div>

        <form onSubmit={handleAddNews} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Headline Title</label>
              <input
                type="text"
                placeholder="e.g. End Semester Examinations Schedule & Venues"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Display Priority</label>
              <select
                value={newsType}
                onChange={(e) => setNewsType(e.target.value as "pinned" | "regular")}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-slate-800 transition-colors cursor-pointer"
              >
                <option value="regular">Standard Bulletin</option>
                <option value="pinned">Pinned (High Priority)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Announcement Content</label>
            <textarea
              placeholder="Provide complete details, dates, instructions, or venue information..."
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs font-normal text-slate-900 outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400 min-h-[110px] resize-y leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={addingNews}
              className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer ${
                addingNews ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {addingNews ? "Publishing..." : "Post Announcement"}
            </button>
          </div>
        </form>
      </div>

      {/* Bulletins List */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-900">
              Published Bulletins ({newsList.length})
            </h3>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loadingNews ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800" />
              <p className="text-xs text-slate-400">Loading campus bulletins...</p>
            </div>
          ) : newsList.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              No bulletins published yet. Post an announcement using the form above.
            </div>
          ) : (
            <div className="space-y-3">
              {newsList.map((news) => (
                <div
                  key={news.id}
                  className="p-4 border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors flex flex-col sm:flex-row gap-3.5 justify-between items-start bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-xs font-semibold text-slate-900">{news.title}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          news.type === "pinned"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {news.type === "pinned" ? "Pinned" : "Standard"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{news.content}</p>
                    <p className="text-[11px] text-slate-400 mt-2 font-mono">
                      {new Date(news.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNews(news.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                    title="Remove bulletin"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
