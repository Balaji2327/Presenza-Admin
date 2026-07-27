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
    <div className="max-w-4xl mx-auto space-y-4 lg:space-y-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-orange-500" />
            Post New News
          </h3>
        </div>
        <form onSubmit={handleAddNews} className="p-4 lg:p-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
              <input
                type="text"
                placeholder="e.g. End Semester Exams Schedule"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                required
              />
            </div>
            <div className="w-1/3">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type *</label>
              <select
                value={newsType}
                onChange={(e) => setNewsType(e.target.value as "pinned" | "regular")}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500"
              >
                <option value="regular">Regular News</option>
                <option value="pinned">Pinned News</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Content *</label>
            <textarea
              placeholder="Write the news content here..."
              value={newsContent}
              onChange={(e) => setNewsContent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-medium min-h-[120px] resize-y"
              required
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={addingNews}
              className={`px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer ${
                addingNews ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {addingNews ? "Posting..." : "Post News"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            Published News
          </h3>
        </div>
        <div className="p-6">
          {loadingNews ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : newsList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm font-semibold">
              No news published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {newsList.map((news) => (
                <div
                  key={news.id}
                  className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-start"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-800">{news.title}</h4>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                          news.type === "pinned" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {news.type === "pinned" ? "Pinned" : "Regular"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 whitespace-pre-wrap">{news.content}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                      {new Date(news.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNews(news.id)}
                    className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Delete News"
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
