import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoAdmin } from './photo-admin';

describe('PhotoAdmin', () => {
  let component: PhotoAdmin;
  let fixture: ComponentFixture<PhotoAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
