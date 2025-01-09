'use client'
import React, { useState, useRef, useEffect } from 'react';

const UrlImageStitcher: React.FC = () => {
  const [url, setUrl] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageWidth, setImageWidth] = useState<number>(300);
    const [preLoadImages, setPreLoadImages] = useState<string[]>([])


  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const fetchImages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/fetch-images?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
        setPreLoadImages(data.images);
        setImages([])
    } catch (error) {
      console.error(error);
      // Handle error appropriately
    } finally {
      setIsLoading(false);
    }
  };

    useEffect(()=>{
        const fetchAllImage=async ()=>{
            if(preLoadImages.length === 0 ) return;
            setIsLoading(true);
            try{
                const fetchedImage = await Promise.all(preLoadImages.map(handleImageLoad))
                setImages(fetchedImage)

            }catch (e) {
                console.error(e)
            }finally {
                setIsLoading(false)
            }
        }
        fetchAllImage()
    }, [preLoadImages])
    const handleDownload = async () => {
        if (!previewContainerRef.current) {
            console.error('Preview container reference is null.');
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context.');
            return;
        }

        const previewImages = Array.from(previewContainerRef.current.children) as HTMLImageElement[];

        if (previewImages.length === 0) {
            console.error('No images found in the preview container.');
            return;
        }
         // 获取原始图片的尺寸
        const originalImageSizes = await Promise.all(previewImages.map(img => {
            return new Promise<{width: number, height: number}>((resolve,reject)=>{
               const tempImage = new Image()
               tempImage.src = img.src;
               tempImage.onload=()=>{
                resolve({width:tempImage.naturalWidth,height: tempImage.naturalHeight})
               }
                 tempImage.onerror=reject
             })

         }))

        // 计算 canvas 的宽度和高度
        const canvasWidth = imageWidth;
        const canvasHeight = previewImages.reduce((sum, img, index) => sum + (imageWidth / originalImageSizes[index].width)*originalImageSizes[index].height, 0);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
    
    
        let yOffset = 0;
        for (let i = 0; i < previewImages.length; i++) {
            const img = previewImages[i];
            // 获取原始图片的宽高
            const originalWidth = originalImageSizes[i].width;
            const originalHeight = originalImageSizes[i].height;
             // 计算缩放比例
             const scale = imageWidth / originalWidth;
            ctx.drawImage(img, 0, yOffset,  imageWidth, originalHeight * scale);
            yOffset += originalHeight * scale;
        }
    

        canvas.toBlob((blob) => {
            if (blob) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'stitched-image.png';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            } else {
                console.error('Failed to create blob from canvas');
            }
        }, 'image/png');
    };

  const handleImageLoad = async (imageUrl: string): Promise<string> => {
        const proxyImageUrl = new URL('/api/proxy-image', window.location.origin);
        proxyImageUrl.searchParams.set('url', imageUrl);
        try {
            const response = await fetch(proxyImageUrl.toString());
             if(!response.ok){
            throw new Error(`Failed to fetch image ${imageUrl} with ${response.status}`)
           }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
            return url;
        } catch (error) {
            console.error("Error loading image:", imageUrl, error);
            throw error;
        }
    };


  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter URL"
          value={url}
          onChange={handleUrlChange}
          className="border border-gray-300 px-4 py-2 rounded w-full md:w-1/2"
        />
        <button
          onClick={fetchImages}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2"
        >
          Fetch Images
        </button>
      </div>

        {/* 图片宽度控制 */}
        <div className="mb-4">
            <label htmlFor="image-width">Image Width: </label>
            <input
                type="number"
                id="image-width"
                min="100"
                max="1000"
                value={imageWidth}
                onChange={(e) => setImageWidth(parseInt(e.target.value))}
                className="border border-gray-300 px-2 py-1 rounded"
            />
        </div>

      {/* 图片加载指示器 */}
      {isLoading && <div className="mb-4">Loading images...</div>}

      {/* 预览容器 */}
      <div
        ref={previewContainerRef}
        className="flex flex-col items-start mb-4" // 使用 flex-col 进行纵向排列
      >
        { images.map((imageUrl, index) => (
            <img
                key={index}
                src={imageUrl}
                alt={`Preview ${index}`}
                className="object-cover"
                style={{ width: `${imageWidth}px`, height: 'auto' }} // 设置统一宽度
            />
          ))}
      </div>
      {/* 下载按钮 */}
      {images.length > 0 && (
        <button
          onClick={handleDownload}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
        >
          下载图片
        </button>
      )}
    </div>
  );
};

export default UrlImageStitcher;

