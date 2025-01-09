'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../app/globals.css';
import { ClipLoader } from 'react-spinners';

const UrlImageStitcher: React.FC = () => {
    const [url, setUrl] = useState<string>('');
    const [images, setImages] = useState<(string | null)[]>([]);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [imageWidth, setImageWidth] = useState<number>(300);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [startX, setStartX] = useState<number>(0);
    const [startY, setStartY] = useState<number>(0);
    const [scrollLeft, setScrollLeft] = useState<number>(0);
    const [scrollTop, setScrollTop] = useState<number>(0);
    const [customFilename, setCustomFilename] = useState<string>('');
    
    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(event.target.value);
    };

    const fetchImages = async () => {
        setIsLoading(true);
        setImages([]);
        try {
            const response = await fetch(`/api/fetch-images?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch images');
            }
            const data = await response.json();
            const imageUrls = data.images;

            setImages(imageUrls.map(() => null));

            imageUrls.forEach(async (imageUrl: string, index: number) => {
                const loadedImage = await handleImageLoad(imageUrl);
                if (loadedImage && loadedImage.width >= 200 && loadedImage.height >= 200) {
                    setImages((prevImages) =>
                        prevImages.map((img, i) => (i === index ? loadedImage.url : img))
                    );
                } else {
                    setImages((prevImages) => prevImages.map((img, i) => (i === index ? null : img)));
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

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

        // Use the 'images' state directly, which contains the filtered image URLs
        if (images.length === 0) {
            console.error('No images to stitch.');
            return;
        }

        // Filter out null values (placeholders) before stitching
        const validImages = images.filter((img) => img !== null) as string[];

        // Create temporary image elements to get the dimensions
        const tempImages = await Promise.all(
            validImages.map((imageUrl) => {
                return new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = imageUrl;
                });
            })
        );

        // Get the original dimensions of the images
        const originalImageSizes = tempImages.map((img) => ({
            width: img.naturalWidth,
            height: img.naturalHeight,
        }));

        // Calculate canvas width and height
        const canvasWidth = imageWidth;
        const canvasHeight = originalImageSizes.reduce((sum, size) => sum + (imageWidth / size.width) * size.height, 0);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        let yOffset = 0;
        for (let i = 0; i < tempImages.length; i++) {
            const img = tempImages[i];
            const originalWidth = originalImageSizes[i].width;
            const originalHeight = originalImageSizes[i].height;
            const scale = imageWidth / originalWidth;
            ctx.drawImage(img, 0, yOffset, imageWidth, originalHeight * scale);
            yOffset += originalHeight * scale;
        }

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${customFilename}.png`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                } else {
                    console.error('Failed to create blob from canvas');
                }
            },
            'image/png'
        );
    };

    const handleImageLoad = async (imageUrl: string): Promise<{ url: string, width: number, height: number } | null> => {
        // Return object with URL and dimensions, or null if failed
        const proxyImageUrl = new URL('/api/proxy-image', window.location.origin);
        proxyImageUrl.searchParams.set('url', imageUrl);
        try {
            const response = await fetch(proxyImageUrl.toString());
            if (!response.ok) {
                throw new Error(`Failed to fetch image ${imageUrl} with ${response.status}`);
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    resolve({ url: blobUrl, width: img.naturalWidth, height: img.naturalHeight });
                };
                img.onerror = () => {
                    console.error('Error loading image:', imageUrl);
                    resolve(null); // Resolve with null for failed images
                };
                img.src = blobUrl;
            });
        } catch (error) {
            console.error('Error loading image:', imageUrl, error);
            return null;
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const deltaY = event.deltaY;
        if (previewContainerRef.current) {
            previewContainerRef.current.scrollTop += deltaY;
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

    const handleMouseMove = useCallback(
        (event: MouseEvent) => {
            if (!isDragging) return;
            const newScrollLeft = event.pageX - startX;
            const newScrollTop = event.pageY - startY;
            setScrollLeft(newScrollLeft);
            setScrollTop(newScrollTop);
            if (previewContainerRef.current) {
                previewContainerRef.current.scrollTo({
                    top: newScrollTop,
                    left: newScrollLeft,
                });
            }
        },
        [isDragging, startX, startY, previewContainerRef]
    );

    useEffect(() => {
        if (previewContainerRef.current) {
            previewContainerRef.current.addEventListener('mousemove', handleMouseMove);
            previewContainerRef.current.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            if (previewContainerRef.current) {
                previewContainerRef.current.removeEventListener('mousemove', handleMouseMove);
                previewContainerRef.current.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }, [isDragging, startX, startY, handleMouseMove]);

    const handleDownloadImage = (imageUrl: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = ''; // You can specify a filename here if needed
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImages((prevImages) => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleFilenameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCustomFilename(event.target.value);
    };

    const handleBatchDownload = () => {
        if (images.length === 0) {
            console.error('No images to download.');
            return;
        }
    
        const validImages = images.filter((img) => img !== null) as string[];
        validImages.forEach((imageUrl, index) => {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `${customFilename}${index + 1}.png`; // 文件名格式：自定义文件名+序号.png
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };
    
    return (
        <div className="container mx-auto w-full p-2 flex flex-col md:flex-row">
            {/* 左侧内容 */}
            <div className="md:w-1/3 lg:w-1/4 mb-4 md:mb-0 md:mr-10">
                <div className="text-center mb-4 md:mb-8">
                    <h1 className="font-lora text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">链接拼图</h1>
                </div>
                <div className="font-lora font-light mb-4 flex md:flex-col md:items-center">
                    <input
                        type="text"
                        placeholder="输入网页链接"
                        value={url}
                        onChange={handleUrlChange}
                        className="border border-gray-300 px-4 py-2 rounded w-full focus:outline-none focus:shadow-outline"
                    />
                    <button
                        onClick={fetchImages}
                        className="font-lora bg-blue-500 hover:bg-blue-700 text-white text-LG py-2 px-4 rounded ml-2  md:mt-4 w-36 md:w-auto focus:outline-none focus:shadow-outline"
                    >
                        获取图片
                    </button>
                </div>

                {/* 图片宽度控制和下载按钮 */}
                <div className="flex flex-col items-center mb-4">
                    <div className="flex-col lg:flex-row md:flex-row items-center w-full mt-2">
                        <div className='flex items-center'>
                            <input
                            type="text"
                            placeholder="自定义文件名"
                            value={customFilename}
                            onChange={handleFilenameChange}
                            className="font-lora border border-gray-300 px-4 py-2 rounded w-full placeholder-gray-400 focus:outline-none focus:shadow-outline placeholder-opacity-50 text-right"
                        />
                        <span className="ml-2 text-gray-800">.png</span>
                        </div>
                        <div className="flex md:flex-row lg:flex-row items-center justify-center mb-2 mt-4 md:mb-0 w-full md:w-auto">
                            <label htmlFor="image-width" className="font-lora text-xl block mb-1 mr-2 w-40text-gray-800">
                                宽度
                            </label>
                            <input
                                type="number"
                                id="image-width"
                                min="100"
                                max="1000"
                                step="50"
                                value={imageWidth}
                                onChange={(e) => setImageWidth(parseInt(e.target.value))}
                                className="font-lora border border-gray-300 px-4 py-2 rounded focus:outline-none focus:shadow-outline"
                            />
                            <label htmlFor="image-width" className="font-lora text-xl block mb-1 ml-2 w-40text-gray-800">
                                像素
                            </label>
                        </div>
                        <div className="flex justify-center items-center mt-4 w-full md:w-auto">
                        <button
                            onClick={handleBatchDownload} // 新增的按钮和事件处理函数
                            className="font-lora bg-green-500 hover:bg-green-600 text-white py-2 px-2 rounded mr-2"
                        >
                            一键下载
                        </button>
                        <button
                            onClick={handleDownload}
                            className="font-lora bg-orange-500 hover:bg-orange-600 text-white py-2 px-2 rounded ml-2"
                        >
                            拼接图片
                        </button>
                        </div>
                    </div>
                </div>
                {/* 图片加载指示器 */}
                {isLoading && (
                    <div className="font-lora mb-4 flex justify-center items-center">
                        <ClipLoader color="#4A90E2" loading={isLoading} size={35} />
                        <span className="ml-2 text-xl text-gray-800">Loading images...</span>
                    </div>
                )}
            </div>
            {/* 右侧预览容器 */}
            <div
                ref={previewContainerRef}
                className="image-container md:w-2/3 overflow-auto border border-gray-300 relative flex flex-col items-center scrollbar-modern"
                style={{ maxHeight: '100vh', cursor: isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
            >
                {images.map((imageUrl, index) => (
                    <div
                        key={index}
                        className="image-wrapper relative"
                        style={{ width: `${imageWidth}px`, display: 'flex', justifyContent: 'center'}} // Added margin for spacing
                    >
                        {imageUrl ? (
                            <>
                                <img src={imageUrl} alt={`Preview ${index}`} style={{ width: '100%' }} />
                                <div className="overlay absolute top-0 left-0 w-full h-full flex justify-between p-1 opacity-0 hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        onClick={() => handleDownloadImage(imageUrl)}
                                        className="w-10 h-10 bg-gray-200/80 hover:bg-gray-800/30 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </button>
                                    <button
                                        onClick={() => handleRemoveImage(index)}
                                        className="w-10 h-10 bg-red-500/20 hover:bg-red-500 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div
                                className="animate-pulse bg-gray-300"
                                style={{ width: '100%', height: `100px` }}
                            >
                                <div className="overlay absolute top-0 left-0 w-full h-full flex justify-between p-1 opacity-0 hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        onClick={() => handleRemoveImage(index)}
                                        className="absolute top-1 right-1 w-10 h-10 bg-red-500/20 hover:bg-red-500 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                    <ClipLoader color="#4A90E2" className='absolute top-1/3 left-1/2' size={35} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UrlImageStitcher;
