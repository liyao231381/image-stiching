'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../app/globals.css';

const UrlImageStitcher: React.FC = () => {
    const [url, setUrl] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [imageWidth, setImageWidth] = useState<number>(300);
    const [preLoadImages, setPreLoadImages] = useState<string[]>([])
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [startX, setStartX] = useState<number>(0);
    const [startY, setStartY] = useState<number>(0);
    const [scrollLeft, setScrollLeft] = useState<number>(0);
    const [scrollTop, setScrollTop] = useState<number>(0);

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
        const canvasHeight = previewImages.reduce((sum, img, index) => sum + (imageWidth / originalImageSizes[index].width) * originalImageSizes[index].height, 0);
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
            ctx.drawImage(img, 0, yOffset, imageWidth, originalHeight * scale);
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


    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
          event.preventDefault();
             const deltaY = event.deltaY;
               if(previewContainerRef.current){
                   previewContainerRef.current.scrollTop += deltaY
               }
    };


    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        setStartX(event.pageX - scrollLeft);
        setStartY(event.pageY - scrollTop);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

  const handleMouseMove =  useCallback((event: MouseEvent) => {
         if (!isDragging) return;
        const newScrollLeft = event.pageX - startX;
        const newScrollTop = event.pageY - startY;
        setScrollLeft(newScrollLeft);
        setScrollTop(newScrollTop);
      if(previewContainerRef.current)
         {
            previewContainerRef.current.scrollTo({
               top: newScrollTop,
               left: newScrollLeft,
              })
         }
    },[isDragging,startX,startY,previewContainerRef])
     useEffect(() => {
        if(previewContainerRef.current){
            previewContainerRef.current.addEventListener("mousemove", handleMouseMove)
            previewContainerRef.current.addEventListener("mouseup", handleMouseUp)
        }
        return ()=>{
            if(previewContainerRef.current){
                 previewContainerRef.current.removeEventListener("mousemove",handleMouseMove)
                previewContainerRef.current.removeEventListener("mouseup",handleMouseUp)
            }
        }
  },[isDragging,startX,startY,handleMouseMove])

    return (
        <div className="container mx-auto w-full p-2 flex flex-col md:flex-row">
            {/* 左侧内容 */}
            <div className="md:w-1/3 lg:w-1/4 mb-4 md:mb-0 md:mr-10">
            <div className="text-center mb-4 md:mb-8">
              <h1 className="text-2xl font-bold text-gray-800">链接拼图</h1>
          </div>
                <div className="mb-4 flex md:flex-col md:items-center">
                    <input
                        type="text"
                        placeholder="Enter URL"
                        value={url}
                        onChange={handleUrlChange}
                        className="border border-gray-300 px-4 py-2 rounded w-full"
                    />
                    <button
                        onClick={fetchImages}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2  md:mt-4 w-36 md:w-auto"
                    >
                        获取图片
                    </button>
                </div>

                {/* 图片宽度控制和下载按钮 */}
                <div className="flex flex-col items-center mb-4">
                    <div className="flex flex-col md:flex-row lg:flex-row items-center mb-2 md:mb-0 md:mr-2 w-full md:w-auto">
                        <label htmlFor="image-width" className='block mb-1'>宽度：</label>
                        <input
                            type="number"
                            id="image-width"
                            min="100"
                            max="1000"
                            value={imageWidth}
                            onChange={(e) => setImageWidth(parseInt(e.target.value))}
                            className="border border-gray-300 px-2 py-1 rounded w-full md:w-auto"
                         />
                    </div>
                         {images.length > 0 && (
                            <button
                                onClick={handleDownload}
                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto md:mt-4"
                            >
                                拼接图片
                            </button>
                        )}

                </div>
               {/* 图片加载指示器 */}
                {isLoading && <div className="mb-4">Loading images...</div>}
            </div>
            {/* 右侧预览容器 */}
            <div
                ref={previewContainerRef}
                 className="image-container md:w-2/3 overflow-auto border border-gray-300 relative flex flex-col items-center scrollbar-modern" // 添加 flex 和纵向排列, 以及现代化滚动条样式
                style={{ maxHeight: '100vh',cursor:isDragging?"grabbing":"grab"}}
                 onMouseDown={handleMouseDown}
                 onWheel={handleWheel}
              >
                 {images.map((imageUrl, index) => (
                        <img
                            key={index}
                            src={imageUrl}
                            alt={`Preview ${index}`}
                        />
                    ))}
              </div>
                {/* 图片预加载 */}
              {!isLoading && images.length > 0 &&
            <div style={{display: 'none'}}>
              {
                images.map((imageUrl,index)=>(
                 <img
                   key={index}
                    src={imageUrl}
                   alt={`Preview ${index}`}
                   onLoad={() => {
                   }}
                 />
                ))
               }
            </div>
        }
        </div>
    );
};

export default UrlImageStitcher;
