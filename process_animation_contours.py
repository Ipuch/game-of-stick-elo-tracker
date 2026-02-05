#!/usr/bin/env python3
"""
Process animation frames to extract contours and remove backgrounds.
Converts filled silhouettes to outlined contours with transparent backgrounds.
Uses PIL/Pillow for image processing with improved edge detection.
"""

from PIL import Image, ImageFilter, ImageOps
import numpy as np
from pathlib import Path
from scipy import ndimage


def extract_contour(input_path: Path, output_path: Path, contour_thickness: int = 4):
    """
    Extract contour from an image and create a transparent background version.
    
    Args:
        input_path: Path to input image
        output_path: Path to save output image
        contour_thickness: Thickness of the contour line in pixels
    """
    # Open the image
    img = Image.open(input_path).convert('RGBA')
    
    # Get the alpha channel
    alpha = img.split()[3]
    alpha_np = np.array(alpha)
    
    # Create binary mask
    binary_mask = (alpha_np > 128).astype(np.uint8)
    
    # Use scipy to find edges via erosion
    from scipy.ndimage import binary_erosion, binary_dilation
    
    # Erode the mask
    eroded = binary_erosion(binary_mask, iterations=contour_thickness)
    
    # The contour is the difference between original and eroded
    contour = binary_mask.astype(np.int16) - eroded.astype(np.int16)
    contour = (contour > 0).astype(np.uint8) * 255
    
    # Optionally dilate the contour to make it thicker
    contour_dilated = binary_dilation(contour > 0, iterations=1).astype(np.uint8) * 255
    
    # Get the color from the original image
    # Sample a pixel that's not transparent
    pixels = img.load()
    sample_color = None
    for y in range(img.height):
        for x in range(img.width):
            if pixels[x, y][3] > 0:  # If not transparent
                sample_color = pixels[x, y][:3]  # Get RGB only
                break
        if sample_color:
            break
    
    if sample_color is None:
        sample_color = (0, 255, 255)  # Default to cyan
    
    # Create the result image
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result_np = np.array(result)
    
    # Apply the color where the contour exists
    mask = contour_dilated > 0
    result_np[mask] = sample_color + (255,)
    
    # Convert back to PIL Image
    result = Image.fromarray(result_np, 'RGBA')
    
    # Save the result
    result.save(output_path, 'PNG')
    print(f"Processed: {input_path.name} -> {output_path.name}")


def main():
    # Define paths
    anim_dir = Path("/home/ppuchaud/Documents/perso/game-of-stick-elo-tracker/src-game-of-stick-elo-tracker/assets/anim")
    
    # Process all jump frames
    for i in range(1, 11):
        input_file = anim_dir / f"jump_{i:02d}.png"
        output_file = anim_dir / f"jump_{i:02d}_contour.png"
        
        if input_file.exists():
            extract_contour(input_file, output_file, contour_thickness=3)
        else:
            print(f"Warning: {input_file} not found")
    
    print("\nProcessing complete!")
    print(f"Contour images saved in: {anim_dir}")


if __name__ == "__main__":
    main()
